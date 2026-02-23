'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import AppointmentModal from '@/components/calendar/AppointmentModal'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import type { AppointmentWithRelations, AppointmentStatus } from '@/lib/supabase/types'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  '予約済み': 'bg-blue-100 text-blue-800',
  '来院済み': 'bg-green-100 text-green-800',
  '診療中': 'bg-yellow-100 text-yellow-800',
  '帰宅済み': 'bg-gray-100 text-gray-600',
  'キャンセル': 'bg-red-100 text-red-700',
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()))
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)

  const fetchAppointments = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments?date=${date}`)
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

  useEffect(() => {
    fetchAppointments(selectedDate)
  }, [selectedDate, fetchAppointments])

  function handleNewAppointment() {
    setSelectedAppointment(null)
    setModalOpen(true)
  }

  function handleEditAppointment(appt: AppointmentWithRelations) {
    setSelectedAppointment(appt)
    setModalOpen(true)
  }

  function handleSaved() {
    fetchAppointments(selectedDate)
  }

  function handleDateChange(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(formatDateLocal(d))
  }

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">予約一覧</h1>
          <Button onClick={handleNewAppointment}>新規予約</Button>
        </div>

        {/* 日付選択 */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => handleDateChange(-1)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-base"
          />
          <button
            onClick={() => handleDateChange(1)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSelectedDate(formatDateLocal(new Date()))}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
          >
            今日
          </button>
        </div>

        {/* 日付表示 */}
        <p className="mb-4 text-center text-lg font-medium text-gray-700">
          {dateObj.getMonth() + 1}月{dateObj.getDate()}日（{dayOfWeek}）
        </p>

        {/* 予約一覧 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">この日の予約はありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((appt) => {
              const startTime = new Date(appt.start_time)
              const endTime = new Date(startTime.getTime() + appt.duration_minutes * 60 * 1000)
              const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`
              const endStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
              const statusColor = STATUS_COLORS[appt.status as AppointmentStatus] || 'bg-gray-100 text-gray-600'

              return (
                <button
                  key={appt.id}
                  onClick={() => handleEditAppointment(appt)}
                  className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {timeStr} - {endStr}
                        </span>
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          U{appt.unit_number}
                        </span>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                          {appt.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {appt.patient && (
                          <>
                            <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                              {appt.patient.chart_number}
                            </span>
                            <span className="text-base font-medium text-gray-900">
                              {appt.patient.name}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <span>{appt.appointment_type}</span>
                        {appt.staff && <span>/ {appt.staff.name}</span>}
                        {appt.memo && <span className="truncate">/ {appt.memo}</span>}
                      </div>
                    </div>
                    <svg
                      className="ml-2 h-5 w-5 flex-shrink-0 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 1-3 でFullCalendarに置き換え予定 */}
        <p className="mt-6 text-center text-xs text-gray-400">
          ※ この一覧は仮実装です。Step 1-3 で FullCalendar に置き換えます
        </p>
      </div>

      {/* 予約モーダル */}
      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        appointment={selectedAppointment}
        defaultDate={selectedDate}
      />
    </AppLayout>
  )
}
