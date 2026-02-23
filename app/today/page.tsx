'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/calendar/StatusBadge'
import LabOrderBadge from '@/components/calendar/LabOrderBadge'
import PatientDetailPanel from '@/components/calendar/PatientDetailPanel'
import { getPatientTagIcons } from '@/lib/constants/patient-tags'
import { getNextStatus, STATUS_LABELS, STATUS_TEXT } from '@/lib/constants/appointment'
import { subscribeToChanges, unsubscribe } from '@/lib/supabase/realtime'
import { useToast } from '@/components/ui/Toast'
import type { AppointmentStatus, AppointmentWithRelations, BlockedSlot } from '@/lib/supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function TodayPage() {
  const today = formatDateLocal(new Date())
  const dateObj = new Date(today + 'T00:00:00')
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]

  const { showToast } = useToast()
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Detail Panel
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [detailAppointment, setDetailAppointment] = useState<AppointmentWithRelations | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [apptRes, blockRes] = await Promise.all([
        fetch(`/api/appointments?date=${today}`),
        fetch(`/api/blocked-slots?date=${today}`),
      ])
      const apptData = await apptRes.json()
      const blockData = await blockRes.json()
      if (apptRes.ok) setAppointments(apptData.appointments || [])
      if (blockRes.ok) setBlockedSlots(blockData.blocked_slots || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscription
  useEffect(() => {
    channelRef.current = subscribeToChanges({
      appointments: {
        onInsert: () => fetchData(),
        onUpdate: (payload) => {
          const updated = payload.new as Record<string, unknown>
          const id = updated?.id as string
          if (!id) return

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
                start_time: (updated.start_time as string) ?? a.start_time,
                status: (updated.status as AppointmentStatus) ?? a.status,
                updated_at: (updated.updated_at as string) ?? a.updated_at,
              }
            })
          )
        },
        onDelete: (payload) => {
          const old = payload.old as Record<string, unknown>
          const id = old?.id as string
          if (id) setAppointments(prev => prev.filter(a => a.id !== id))
        },
      },
    })

    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [fetchData])

  // Tab visibility refresh
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchData()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchData])

  // Status change (optimistic)
  const handleStatusChange = useCallback(async (id: string, newStatus: AppointmentStatus) => {
    const current = appointments.find(a => a.id === id)
    if (!current) return
    const oldStatus = current.status

    // Optimistic update
    setAppointments(prev =>
      prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
    )

    try {
      const res = await fetch('/api/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, current_updated_at: current.updated_at }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Revert
        setAppointments(prev =>
          prev.map(a => a.id === id ? { ...a, status: oldStatus } : a)
        )
        if (data.conflict) {
          fetchData()
          showToast('他の端末で更新されたため、最新データを再取得しました', 'info')
        } else {
          showToast(data.error || 'ステータス更新に失敗しました', 'error')
        }
        return
      }

      if (data.appointment) {
        setAppointments(prev =>
          prev.map(a => a.id === id ? { ...a, status: data.appointment.status, updated_at: data.appointment.updated_at } : a)
        )
      }
    } catch {
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: oldStatus } : a)
      )
      showToast('ステータス更新に失敗しました', 'error')
    }
  }, [appointments, fetchData, showToast])

  // Quick next status button
  const handleQuickStatusAdvance = useCallback((appt: AppointmentWithRelations) => {
    const next = getNextStatus(appt.status)
    if (next) handleStatusChange(appt.id, next)
  }, [handleStatusChange])

  // Build combined list (appointments + blocks), sorted by time
  type ListItem =
    | { type: 'appointment'; data: AppointmentWithRelations; time: Date }
    | { type: 'block'; data: BlockedSlot; time: Date }

  const listItems: ListItem[] = [
    ...appointments.map(a => ({
      type: 'appointment' as const,
      data: a,
      time: new Date(a.start_time),
    })),
    ...blockedSlots.map(b => ({
      type: 'block' as const,
      data: b,
      time: new Date(b.start_time),
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {'\u{1F4CB}'} 本日の予約（{dateObj.getMonth() + 1}/{dateObj.getDate()} {dayOfWeek}）
          </h1>
          <Link
            href="/calendar"
            className="min-h-[44px] flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            カレンダー表示
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : listItems.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-400">本日の予約はありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="px-3 py-2 w-16">時間</th>
                  <th className="px-3 py-2 w-10">U</th>
                  <th className="px-3 py-2">患者名</th>
                  <th className="px-3 py-2 w-24">種別</th>
                  <th className="px-3 py-2 w-16">担当</th>
                  <th className="px-3 py-2 w-16">技工物</th>
                  <th className="px-3 py-2 w-32 text-center">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listItems.map((item) => {
                  if (item.type === 'block') {
                    const block = item.data
                    const bTime = new Date(block.start_time)
                    const timeStr = bTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={`block-${block.id}`} className="bg-gray-50 text-gray-400">
                        <td className="px-3 py-2 text-xs">{timeStr}</td>
                        <td className="px-3 py-2 text-xs">{block.unit_number === 0 ? '全' : block.unit_number}</td>
                        <td colSpan={4} className="px-3 py-2 text-xs">
                          {'\u{1F6AB}'} {block.reason || 'ブロック'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-500">ブロック</span>
                        </td>
                      </tr>
                    )
                  }

                  const appt = item.data
                  const aTime = new Date(appt.start_time)
                  const timeStr = aTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                  const tags = appt.patient ? getPatientTagIcons(appt.patient) : []
                  const nextStatus = getNextStatus(appt.status)
                  const isCancelledOrNoShow = appt.status === 'cancelled' || appt.status === 'no_show'

                  return (
                    <tr
                      key={appt.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        isCancelledOrNoShow ? 'opacity-50' : ''
                      }`}
                      onClick={() => {
                        setDetailAppointment(appt)
                        setDetailPanelOpen(true)
                      }}
                    >
                      <td className="px-3 py-2 text-sm text-gray-700">{timeStr}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{appt.unit_number}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">{appt.patient?.name || '—'}</span>
                          {tags.map((tag, i) => (
                            <span
                              key={i}
                              title={tag.label}
                              style={{ color: tag.color }}
                              className={`text-xs ${tag.label === '\u611F\u67D3\u6CE8\u610F' ? 'rounded bg-purple-100 px-0.5' : ''}`}
                            >
                              {tag.icon}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[100px]">
                        {appt.appointment_type}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 truncate">
                        {appt.staff?.name || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {appt.lab_order && (
                          <LabOrderBadge labOrderStatus={appt.lab_order.status} size="sm" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        {isCancelledOrNoShow ? (
                          <StatusBadge status={appt.status} size="sm" />
                        ) : nextStatus ? (
                          <button
                            onClick={() => handleQuickStatusAdvance(appt)}
                            className="min-h-[36px] rounded-full px-3 py-1 text-xs font-medium text-white transition-colors"
                            style={{
                              backgroundColor: STATUS_TEXT[appt.status] || '#374151',
                            }}
                          >
                            {STATUS_LABELS[appt.status as AppointmentStatus]}
                            {' '}→
                          </button>
                        ) : (
                          <StatusBadge status={appt.status} size="sm" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Detail Panel */}
      {detailAppointment && (
        <PatientDetailPanel
          isOpen={detailPanelOpen}
          onClose={() => setDetailPanelOpen(false)}
          appointment={detailAppointment}
          onStatusChange={handleStatusChange}
          onEditClick={() => {
            // From today page, no edit modal — just close panel
            setDetailPanelOpen(false)
          }}
          onNewAppointment={() => {
            setDetailPanelOpen(false)
          }}
          onJumpToDate={() => {
            // Already on today page, no-op
          }}
        />
      )}
    </AppLayout>
  )
}
