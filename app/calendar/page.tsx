'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import AppLayout from '@/components/layout/AppLayout'
import AppointmentModal from '@/components/calendar/AppointmentModal'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { AppointmentWithRelations } from '@/lib/supabase/types'
import type { BusinessHours, CalendarResource } from '@/components/calendar/CalendarView'

const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), { ssr: false })

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type ViewType = 'resourceTimeGridDay' | 'resourceTimeGridWeek'

export default function CalendarPage() {
  const { showToast } = useToast()

  // State
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()))
  const [viewType, setViewType] = useState<ViewType>('resourceTimeGridDay')
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)

  // Settings
  const [unitCount, setUnitCount] = useState(5)
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    start: '09:00', end: '18:00', lunch_start: '12:30', lunch_end: '14:00',
  })
  const [staffColors, setStaffColors] = useState<Record<string, string>>({})
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([])

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)
  const [defaultModalDate, setDefaultModalDate] = useState<string>('')
  const [defaultModalTime, setDefaultModalTime] = useState<string>('')
  const [defaultModalUnit, setDefaultModalUnit] = useState<number>(1)

  // Unit filter (mobile)
  const [filteredUnit, setFilteredUnit] = useState<number | null>(null)

  // Resources
  const resources: CalendarResource[] = useMemo(() => {
    const count = filteredUnit ? 1 : unitCount
    if (filteredUnit) {
      return [{ id: String(filteredUnit), title: `ユニット${filteredUnit}` }]
    }
    return Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      title: `U${i + 1}`,
    }))
  }, [unitCount, filteredUnit])

  // Date range for fetching (use ref to avoid re-render loops)
  const fetchRangeRef = useRef<string>('')
  const [fetchRange, setFetchRange] = useState<{ start: string; end: string } | null>(null)

  // Fetch settings + staff on mount
  useEffect(() => {
    Promise.all([fetchSettings(), fetchStaff()]).then(() => {
      setSettingsReady(true)
    })
  }, [])

  // Fetch appointments when date range changes
  useEffect(() => {
    if (fetchRange) {
      fetchAppointments(fetchRange.start, fetchRange.end)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRange])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        const s = data.settings
        if (s.unit_count) setUnitCount(parseInt(s.unit_count))
        if (s.business_hours) {
          try {
            const bh = JSON.parse(s.business_hours)
            setBusinessHours({
              start: bh.start || '09:00',
              end: bh.end || '18:00',
              lunch_start: bh.lunch_start || '12:30',
              lunch_end: bh.lunch_end || '14:00',
            })
          } catch { /* ignore */ }
        }
        if (s.staff_colors) {
          try { setStaffColors(JSON.parse(s.staff_colors)) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  async function fetchStaff() {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok) setStaffList(data.users || [])
    } catch { /* ignore */ }
  }

  async function fetchAppointments(startDate: string, endDate: string) {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/appointments?start_date=${startDate}&end_date=${endDate}`
      )
      const data = await res.json()
      if (res.ok) {
        setAppointments(data.appointments || [])
      }
    } catch { /* ignore */ }
    finally {
      setLoading(false)
    }
  }

  // Calendar callbacks
  const handleDatesSet = useCallback((start: Date, end: Date) => {
    const startStr = formatDateLocal(start)
    const endDate = new Date(end.getTime() - 1) // end is exclusive
    const endStr = formatDateLocal(endDate)
    const rangeKey = `${startStr}_${endStr}`
    // Only update if range actually changed (prevents infinite loop)
    if (fetchRangeRef.current !== rangeKey) {
      fetchRangeRef.current = rangeKey
      setFetchRange({ start: startStr, end: endStr })
    }
  }, [])

  const handleDateSelect = useCallback((start: Date, _end: Date, resourceId: string) => {
    setSelectedAppointment(null)
    setDefaultModalDate(formatDateLocal(start))
    setDefaultModalTime(
      `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    )
    setDefaultModalUnit(parseInt(resourceId) || 1)
    setModalOpen(true)
  }, [])

  const handleEventClick = useCallback((appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId)
    if (appt) {
      setSelectedAppointment(appt)
      setModalOpen(true)
    }
  }, [appointments])

  const handleEventDrop = useCallback(
    async (appointmentId: string, newStart: Date, newResourceId: string, revert: () => void) => {
      const startTime = newStart.toISOString()
      const appt = appointments.find((a) => a.id === appointmentId)
      if (!appt) { revert(); return }

      try {
        const res = await fetch('/api/appointments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: appointmentId,
            unit_number: parseInt(newResourceId),
            start_time: startTime,
            duration_minutes: appt.duration_minutes,
            patient_id: appt.patient_id,
            staff_id: appt.staff_id,
            appointment_type: appt.appointment_type,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          showToast(data.error || '移動に失敗しました', 'error')
          revert()
          return
        }

        showToast('予約を移動しました', 'success')
        if (fetchRange) fetchAppointments(fetchRange.start, fetchRange.end)
      } catch {
        showToast('通信エラーが発生しました', 'error')
        revert()
      }
    },
    [appointments, fetchRange, showToast]
  )

  function handleSaved() {
    if (fetchRange) fetchAppointments(fetchRange.start, fetchRange.end)
  }

  function handleNewAppointment() {
    setSelectedAppointment(null)
    setDefaultModalDate(selectedDate)
    setDefaultModalTime('')
    setDefaultModalUnit(1)
    setModalOpen(true)
  }

  function handleDateChange(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(formatDateLocal(d))
  }

  function handleGoToday() {
    setSelectedDate(formatDateLocal(new Date()))
  }

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]

  return (
    <AppLayout>
      <div className="p-2 sm:p-4">
        {/* 上部コントロール */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {/* 日付ナビゲーション */}
          <div className="flex items-center gap-1">
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
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
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
              onClick={handleGoToday}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
            >
              今日
            </button>
          </div>

          {/* 日付表示 */}
          <span className="text-sm font-medium text-gray-700">
            {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
          </span>

          {/* 表示切替 */}
          <div className="flex rounded-md border border-gray-300">
            <button
              onClick={() => setViewType('resourceTimeGridDay')}
              className={`min-h-[44px] px-3 text-sm ${
                viewType === 'resourceTimeGridDay'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-l-md`}
            >
              日
            </button>
            <button
              onClick={() => setViewType('resourceTimeGridWeek')}
              className={`min-h-[44px] px-3 text-sm ${
                viewType === 'resourceTimeGridWeek'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-r-md border-l border-gray-300`}
            >
              週
            </button>
          </div>

          {/* 新規予約ボタン */}
          <div className="ml-auto">
            <Button onClick={handleNewAppointment}>新規予約</Button>
          </div>
        </div>

        {/* ユニットフィルター（モバイル/タブレット） */}
        <div className="mb-2 flex gap-1 overflow-x-auto sm:hidden">
          <button
            onClick={() => setFilteredUnit(null)}
            className={`min-h-[36px] flex-shrink-0 rounded-full px-3 text-xs font-medium ${
              filteredUnit === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            全て
          </button>
          {Array.from({ length: unitCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setFilteredUnit(filteredUnit === n ? null : n)}
              className={`min-h-[36px] flex-shrink-0 rounded-full px-3 text-xs font-medium ${
                filteredUnit === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              U{n}
            </button>
          ))}
        </div>

        {/* カレンダー本体 */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden relative">
          {!settingsReady ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-gray-400">読み込み中...</div>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                  <div className="text-gray-400">読み込み中...</div>
                </div>
              )}
              <CalendarView
                appointments={appointments}
                resources={resources}
                businessHours={businessHours}
                staffColors={staffColors}
                staffList={staffList}
                initialDate={selectedDate}
                viewType={viewType}
                onDateSelect={handleDateSelect}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
                onDatesSet={handleDatesSet}
              />
            </>
          )}
        </div>
      </div>

      {/* 予約モーダル */}
      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        appointment={selectedAppointment}
        defaultDate={defaultModalDate}
        defaultUnitNumber={defaultModalUnit}
        defaultStartTime={defaultModalTime}
      />
    </AppLayout>
  )
}
