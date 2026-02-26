'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOptimisticUpdate } from './useOptimisticUpdate'
import { subscribeToChanges, unsubscribe } from '@/lib/supabase/realtime'
import { useToast } from '@/components/ui/Toast'
import type { AppointmentStatus, AppointmentWithRelations, LabOrderStatus } from '@/lib/supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useAppointments() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const { execute, isPending } = useOptimisticUpdate()
  const { showToast } = useToast()

  // 現在の取得範囲を保持（refreshで再利用）
  const currentRangeRef = useRef<{ start: string; end: string } | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // 予約一覧取得
  const fetchAppointments = useCallback(async (startDate: string, endDate: string) => {
    currentRangeRef.current = { start: startDate, end: endDate }
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments?start_date=${startDate}&end_date=${endDate}`)
      const data = await res.json()
      if (res.ok) {
        setAppointments(data.appointments || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // 強制再取得
  const refreshAppointments = useCallback(async () => {
    if (currentRangeRef.current) {
      await fetchAppointments(currentRangeRef.current.start, currentRangeRef.current.end)
    }
  }, [fetchAppointments])

  // 単一予約をAPI取得してstateに追加
  const fetchAndAddAppointment = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/appointments?id=${id}`)
      const data = await res.json()
      if (res.ok && data.appointment) {
        setAppointments(prev => {
          // 重複チェック
          if (prev.some(a => a.id === id)) return prev
          return [...prev, data.appointment]
        })
      }
    } catch {
      // ignore
    }
  }, [])

  // Realtime サブスクリプション
  useEffect(() => {
    channelRef.current = subscribeToChanges({
      appointments: {
        onInsert: (payload) => {
          const newRecord = payload.new as Record<string, unknown>
          const id = newRecord?.id as string
          if (!id || isPending(id)) return
          fetchAndAddAppointment(id)
        },
        onUpdate: (payload) => {
          const updated = payload.new as Record<string, unknown>
          const id = updated?.id as string
          if (!id || isPending(id)) return

          if (updated.is_deleted) {
            setAppointments(prev => prev.filter(a => a.id !== id))
            return
          }

          setAppointments(prev =>
            prev.map(a => {
              if (a.id !== id) return a
              return {
                ...a,
                unit_number: (updated.unit_number as number) ?? a.unit_number,
                staff_id: (updated.staff_id as string) ?? a.staff_id,
                start_time: (updated.start_time as string) ?? a.start_time,
                duration_minutes: (updated.duration_minutes as number) ?? a.duration_minutes,
                appointment_type: (updated.appointment_type as string) ?? a.appointment_type,
                status: (updated.status as AppointmentStatus) ?? a.status,
                memo: (updated.memo as string | null) ?? a.memo,
                lab_order_id: (updated.lab_order_id as string | null) ?? a.lab_order_id,
                slide_from_id: (updated.slide_from_id as string | null) ?? a.slide_from_id,
                updated_at: (updated.updated_at as string) ?? a.updated_at,
              }
            })
          )
        },
        onDelete: (payload) => {
          const old = payload.old as Record<string, unknown>
          const id = old?.id as string
          if (id) {
            setAppointments(prev => prev.filter(a => a.id !== id))
          }
        },
      },
      labOrders: {
        onUpdate: (payload) => {
          const updated = payload.new as Record<string, unknown>
          const labOrderId = updated?.id as string
          if (!labOrderId) return

          // lab_order_id で紐付いた予約の lab_order データを更新
          setAppointments(prev =>
            prev.map(a => {
              if (a.lab_order_id !== labOrderId || !a.lab_order) return a
              return {
                ...a,
                lab_order: {
                  ...a.lab_order,
                  status: (updated.status as LabOrderStatus) ?? a.lab_order.status,
                  due_date: (updated.due_date as string | null) ?? a.lab_order.due_date,
                  set_date: (updated.set_date as string | null) ?? a.lab_order.set_date,
                },
              }
            })
          )
        },
      },
    })

    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isPending, fetchAndAddAppointment])

  // タブ復帰時にリフレッシュ
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshAppointments()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshAppointments])

  // ステータス更新（楽観的更新）
  const updateStatus = useCallback(async (id: string, newStatus: AppointmentStatus) => {
    const current = appointments.find(a => a.id === id)
    if (!current) return

    const oldStatus = current.status
    const oldUpdatedAt = current.updated_at

    try {
      await execute(
        id,
        () => {
          setAppointments(prev =>
            prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
          )
        },
        async () => {
          const res = await fetch('/api/appointments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              status: newStatus,
              current_updated_at: oldUpdatedAt,
            }),
          })

          const data = await res.json()

          if (res.status === 409 && data.conflict) {
            await refreshAppointments()
            showToast('他の端末で更新されたため、最新データを再取得しました', 'info')
            return data
          }

          if (!res.ok) {
            throw new Error(data.error || 'ステータス更新に失敗しました')
          }

          const appt = data.appointment
          if (appt) {
            setAppointments(prev =>
              prev.map(a => a.id === id ? { ...a, updated_at: appt.updated_at, status: appt.status } : a)
            )
          }
          return data
        },
        () => {
          setAppointments(prev =>
            prev.map(a => a.id === id ? { ...a, status: oldStatus } : a)
          )
        },
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'ステータス更新に失敗しました',
        'error'
      )
    }
  }, [appointments, execute, refreshAppointments, showToast])

  // ドラッグ移動（楽観的更新）
  const moveAppointment = useCallback(async (
    id: string,
    newStart: Date,
    newResourceId: string,
    revert: () => void,
  ) => {
    const current = appointments.find(a => a.id === id)
    if (!current) { revert(); return }

    const startTime = newStart.toISOString()
    const newUnitNumber = parseInt(newResourceId)

    try {
      await execute(
        id,
        () => {
          setAppointments(prev =>
            prev.map(a => a.id === id
              ? { ...a, start_time: startTime, unit_number: newUnitNumber }
              : a
            )
          )
        },
        async () => {
          const res = await fetch('/api/appointments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              unit_number: newUnitNumber,
              start_time: startTime,
              duration_minutes: current.duration_minutes,
              patient_id: current.patient_id,
              staff_id: current.staff_id,
              appointment_type: current.appointment_type,
              current_updated_at: current.updated_at,
            }),
          })

          const data = await res.json()

          if (res.status === 409 && data.conflict) {
            revert()
            await refreshAppointments()
            showToast('他の端末で更新されたため、最新データを再取得しました', 'info')
            return data
          }

          if (!res.ok) {
            throw new Error(data.error || '移動に失敗しました')
          }

          const appt = data.appointment
          if (appt) {
            setAppointments(prev =>
              prev.map(a => a.id === id ? { ...a, ...appt, patient: a.patient, staff: a.staff } : a)
            )
          }

          showToast('予約を移動しました', 'success')
          return data
        },
        () => {
          revert()
        },
      )
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '移動に失敗しました',
        'error'
      )
    }
  }, [appointments, execute, refreshAppointments, showToast])

  // 予約追加（モーダル作成後に呼ぶ）
  const addAppointment = useCallback((appt: AppointmentWithRelations) => {
    setAppointments(prev => {
      if (prev.some(a => a.id === appt.id)) return prev
      return [...prev, appt]
    })
  }, [])

  // 予約除去（モーダル削除後に呼ぶ）
  const removeAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id))
  }, [])

  return {
    appointments,
    loading,
    fetchAppointments,
    refreshAppointments,
    updateStatus,
    moveAppointment,
    addAppointment,
    removeAppointment,
  }
}
