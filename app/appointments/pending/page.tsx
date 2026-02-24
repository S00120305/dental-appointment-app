'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import type { AppointmentWithRelations } from '@/lib/supabase/types'
import { useSettings } from '@/hooks/useSettings'

const fetcher = (url: string) => fetch(url).then(res => res.json())

type PendingAppointment = AppointmentWithRelations & {
  patient: {
    id: string
    chart_number: string
    name: string
    name_kana: string | null
    phone: string | null
    is_vip: boolean
    caution_level: number
    is_infection_alert: boolean
  } | null
}

export default function PendingAppointmentsPage() {
  const { data, isLoading, mutate } = useSWR<{ appointments: PendingAppointment[] }>(
    '/api/appointments?status=pending&booking_source=web',
    fetcher,
    { revalidateOnFocus: true }
  )

  const { visibleUnits } = useSettings()

  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 却下モーダル
  const [rejectTarget, setRejectTarget] = useState<PendingAppointment | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 変更承認モーダル
  const [modifyTarget, setModifyTarget] = useState<PendingAppointment | null>(null)
  const [modifyDate, setModifyDate] = useState('')
  const [modifyTime, setModifyTime] = useState('')
  const [modifyUnit, setModifyUnit] = useState(1)

  const appointments = data?.appointments || []

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleApprove(appt: PendingAppointment) {
    setProcessing(appt.id)
    try {
      const res = await fetch('/api/booking/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appt.id, action: 'approve' }),
      })
      const result = await res.json()
      if (res.ok) {
        showToast('予約を承認しました', 'success')
        mutate()
      } else {
        showToast(result.error || '承認に失敗しました', 'error')
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setProcessing(null)
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    setProcessing(rejectTarget.id)
    try {
      const res = await fetch('/api/booking/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: rejectTarget.id,
          action: 'reject',
          reason: rejectReason.trim() || undefined,
        }),
      })
      const result = await res.json()
      if (res.ok) {
        showToast('予約を却下しました', 'success')
        setRejectTarget(null)
        setRejectReason('')
        mutate()
      } else {
        showToast(result.error || '却下に失敗しました', 'error')
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setProcessing(null)
    }
  }

  function openModifyModal(appt: PendingAppointment) {
    const d = new Date(appt.start_time)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setModifyTarget(appt)
    setModifyDate(dateStr)
    setModifyTime(timeStr)
    setModifyUnit(appt.unit_number)
  }

  async function handleModifyConfirm() {
    if (!modifyTarget || !modifyDate || !modifyTime) return
    setProcessing(modifyTarget.id)
    try {
      const newStartTime = `${modifyDate}T${modifyTime}:00+09:00`
      const res = await fetch('/api/booking/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: modifyTarget.id,
          action: 'modify_approve',
          start_time: newStartTime,
          unit_number: modifyUnit,
        }),
      })
      const result = await res.json()
      if (res.ok) {
        showToast('日時を変更して承認しました', 'success')
        setModifyTarget(null)
        mutate()
      } else {
        showToast(result.error || '変更承認に失敗しました', 'error')
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const formatDateTime = (startTime: string) => {
    const d = new Date(startTime)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day}(${dow}) ${hours}:${minutes}`
  }

  const formatCreatedAt = (createdAt: string) => {
    const d = new Date(createdAt)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day} ${hours}:${minutes}`
  }

  // 時間選択肢生成（5分刻み、8:00-20:00）
  const timeOptions: string[] = []
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 20 && m > 0) break
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/appointments"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            承認待ちの予約リクエスト
            {!isLoading && appointments.length > 0 && (
              <span className="ml-2 text-base font-normal text-gray-500">（{appointments.length}件）</span>
            )}
          </h1>
        </div>

        {/* ローディング */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
                <div className="h-4 w-1/3 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                <div className="mt-4 flex gap-2">
                  <div className="h-10 w-24 rounded bg-gray-200" />
                  <div className="h-10 w-24 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          /* 空状態 */
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-gray-500">承認待ちの予約リクエストはありません</p>
          </div>
        ) : (
          /* カード一覧 */
          <div className="space-y-3">
            {appointments.map(appt => {
              const patient = appt.patient && !Array.isArray(appt.patient)
                ? (appt.patient as PendingAppointment['patient'])
                : null
              const bookingType = appt.booking_type && !Array.isArray(appt.booking_type)
                ? (appt.booking_type as { id: string; display_name: string; internal_name: string; color: string })
                : null
              const isProcessing = processing === appt.id

              return (
                <div
                  key={appt.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 日時 + 種別 */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-gray-900">
                          {formatDateTime(appt.start_time)}
                        </span>
                        <span className="text-gray-500">〜</span>
                        <span className="text-gray-600">{appt.duration_minutes}分</span>
                        {bookingType && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: bookingType.color ? `${bookingType.color}20` : '#e5e7eb',
                              color: bookingType.color || '#374151',
                            }}
                          >
                            {bookingType.display_name}
                          </span>
                        )}
                      </div>

                      {/* 患者名 + 電話番号 */}
                      <div className="mt-1 flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-800">
                          {patient?.name || '不明'}
                        </span>
                        {patient?.phone && (
                          <span className="text-xs text-gray-500">
                            Tel: {patient.phone}
                          </span>
                        )}
                        {patient?.chart_number && (
                          <span className="text-xs text-gray-400">{patient.chart_number}</span>
                        )}
                      </div>

                      {/* 備考 */}
                      {appt.memo && (
                        <p className="mt-1 text-xs text-gray-500">
                          {appt.memo}
                        </p>
                      )}

                      {/* リクエスト日時 */}
                      <p className="mt-1 text-xs text-gray-400">
                        リクエスト: {formatCreatedAt(appt.created_at)}
                      </p>
                    </div>

                    {/* ユニット表示 */}
                    <span className="text-xs text-gray-400">
                      診察室{appt.unit_number}
                    </span>
                  </div>

                  {/* アクションボタン */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleApprove(appt)}
                      disabled={isProcessing}
                      className="!bg-green-600 hover:!bg-green-700 text-sm"
                    >
                      {isProcessing ? '処理中...' : '承認する'}
                    </Button>
                    <button
                      onClick={() => setRejectTarget(appt)}
                      disabled={isProcessing}
                      className="min-h-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      却下する
                    </button>
                    <button
                      onClick={() => openModifyModal(appt)}
                      disabled={isProcessing}
                      className="min-h-[44px] rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      変更して承認
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 却下モーダル */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">予約を却下</h3>
            <p className="mt-1 text-sm text-gray-600">
              {rejectTarget.patient && !Array.isArray(rejectTarget.patient)
                ? (rejectTarget.patient as { name: string }).name
                : '不明'} さんの予約リクエストを却下します。
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                却下理由（任意）
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="理由を入力（患者に通知されます）"
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason('') }}
                className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={processing === rejectTarget.id}
                className="min-h-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processing === rejectTarget.id ? '処理中...' : '却下する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 変更承認モーダル */}
      {modifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">日時を変更して承認</h3>
            <p className="mt-1 text-sm text-gray-600">
              {modifyTarget.patient && !Array.isArray(modifyTarget.patient)
                ? (modifyTarget.patient as { name: string }).name
                : '不明'} さんの予約日時を変更します。
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <input
                  type="date"
                  value={modifyDate}
                  onChange={(e) => setModifyDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">時間</label>
                <select
                  value={modifyTime}
                  onChange={(e) => setModifyTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {timeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">診察室</label>
                <select
                  value={modifyUnit}
                  onChange={(e) => setModifyUnit(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {visibleUnits.map(n => (
                    <option key={n} value={n}>診察室{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModifyTarget(null)}
                className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <Button
                onClick={handleModifyConfirm}
                disabled={processing === modifyTarget.id || !modifyDate || !modifyTime}
              >
                {processing === modifyTarget.id ? '処理中...' : '変更して承認'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </AppLayout>
  )
}
