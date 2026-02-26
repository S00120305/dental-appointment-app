'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

type AppointmentData = {
  start_time: string
  duration_minutes: number
  status: string
  patient_name: string
  booking_type_name: string
  booking_type_id: string
}

type DateInfo = { date: string; available: boolean }
type SlotInfo = { time: string; period: 'morning' | 'afternoon' }

export default function BookingChangePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [clinicPhone, setClinicPhone] = useState('')

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [dates, setDates] = useState<DateInfo[]>([])
  const [datesLoading, setDatesLoading] = useState(false)

  // Slot state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Change state
  const [changing, setChanging] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [oldStartTime, setOldStartTime] = useState<string>('')

  // Load appointment data
  useEffect(() => {
    if (!token) return

    Promise.all([
      fetch(`/api/booking/confirm/${token}`).then(r => r.json()),
      fetch('/api/booking/deadline').then(r => r.json()),
    ])
      .then(([confirmData, deadlineData]) => {
        if (confirmData.error || !confirmData.appointment) {
          setNotFound(true)
          return
        }

        const appt = confirmData.appointment
        setAppointment(appt)
        setClinicPhone(deadlineData.clinic_phone || '')

        if (appt.status !== 'scheduled' && appt.status !== 'pending') {
          setNotFound(true)
          return
        }

        // 期限チェック（JST固定）
        const deadlineTime = deadlineData.deadline_time || '18:00'
        const apptDate = new Date(appt.start_time)
        const jstMs = apptDate.getTime() + 9 * 60 * 60 * 1000
        const jstDateStr = new Date(jstMs).toISOString().split('T')[0]
        const deadline = new Date(`${jstDateStr}T${deadlineTime}:00+09:00`)
        deadline.setTime(deadline.getTime() - 24 * 60 * 60 * 1000)

        if (new Date() >= deadline) {
          setDeadlinePassed(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  // Fetch available dates when month or appointment changes
  useEffect(() => {
    if (!appointment?.booking_type_id) return
    setDatesLoading(true)
    fetch(`/api/booking/available-dates?type_id=${appointment.booking_type_id}&month=${currentMonth}&source=change`)
      .then(res => res.json())
      .then(data => setDates(data.dates || []))
      .catch(() => setDates([]))
      .finally(() => setDatesLoading(false))
  }, [appointment, currentMonth])

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!appointment?.booking_type_id || !selectedDate) return
    setSlotsLoading(true)
    setSelectedTime(null)
    fetch(`/api/booking/available-slots?type_id=${appointment.booking_type_id}&date=${selectedDate}&source=change`)
      .then(res => res.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [appointment, selectedDate])

  const handleChange = async () => {
    if (!selectedDate || !selectedTime) return
    setChanging(true)
    setChangeError(null)

    try {
      const res = await fetch(`/api/booking/change/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: selectedDate, new_time: selectedTime }),
      })
      const data = await res.json()

      if (res.ok) {
        setOldStartTime(appointment!.start_time)
        setCompleted(true)
      } else {
        setChangeError(data.error || '変更に失敗しました')
        if (data.clinic_phone) setClinicPhone(data.clinic_phone)
      }
    } catch {
      setChangeError('通信エラーが発生しました')
    } finally {
      setChanging(false)
    }
  }

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const now = new Date()
    if (prev.getFullYear() < now.getFullYear() || (prev.getFullYear() === now.getFullYear() && prev.getMonth() < now.getMonth())) return
    setCurrentMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
    setSelectedDate(null)
    setSlots([])
    setSelectedTime(null)
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = new Date(y, m, 1)
    setCurrentMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
    setSelectedDate(null)
    setSlots([])
    setSelectedTime(null)
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

  const formatSelectedDateTime = () => {
    if (!selectedDate || !selectedTime || !appointment) return ''
    const d = new Date(`${selectedDate}T${selectedTime}:00+09:00`)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()]
    const endMs = d.getTime() + appointment.duration_minutes * 60 * 1000
    const endDate = new Date(endMs)
    const endH = String((endDate.getUTCHours() + 9) % 24).padStart(2, '0')
    const endM = String(endDate.getUTCMinutes()).padStart(2, '0')
    return `${m}月${day}日（${dow}）${selectedTime}〜${endH}:${endM}`
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#B8923A" strokeWidth="4" />
            <path className="opacity-75" fill="#B8923A" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  // Not found
  if (notFound || !appointment) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: '#DC26261A' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#DC2626">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>予約が見つかりません</h1>
        <Link
          href="/booking"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white"
          style={{ backgroundColor: '#B8923A' }}
        >
          トップに戻る
        </Link>
      </div>
    )
  }

  // Completed
  if (completed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: '#F0FDF4' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2D8A4E">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium" style={{ color: '#333333' }}>
          ご予約を変更しました
        </h2>

        <div className="mx-auto mt-6 max-w-sm rounded-lg p-4" style={{ backgroundColor: '#F8F5F0' }}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: '#999999' }}>変更前</span>
              <span style={{ color: '#999999', textDecoration: 'line-through' }}>
                {formatDateTime(oldStartTime)}〜
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#333333', fontWeight: 500 }}>変更後</span>
              <span style={{ color: '#333333', fontWeight: 500 }}>
                {formatSelectedDateTime()}
              </span>
            </div>
            <div className="border-t pt-2" style={{ borderColor: '#E8E0D0' }}>
              <p style={{ color: '#666666' }}>
                {appointment.booking_type_name}（{appointment.duration_minutes}分）
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/booking/confirm/${token}`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 text-sm font-medium text-white"
            style={{ backgroundColor: '#B8923A' }}
          >
            予約を確認する
          </Link>
          <Link
            href="/booking"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg border px-6 text-sm font-medium"
            style={{ borderColor: '#B8923A', color: '#B8923A' }}
          >
            トップに戻る
          </Link>
        </div>
      </div>
    )
  }

  // Deadline passed
  if (deadlinePassed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center">
          <h1 className="text-xl font-medium" style={{ color: '#333333' }}>予約の変更</h1>
        </div>
        <div className="mx-auto mt-8 max-w-md rounded-lg p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>
            変更・キャンセルの受付期限を過ぎています。
          </p>
          {clinicPhone && (
            <p className="mt-2 text-sm" style={{ color: '#666666' }}>
              恐れ入りますが、お電話にてご連絡ください。
              <br />
              <a href={`tel:${clinicPhone.replace(/-/g, '')}`} className="font-medium" style={{ color: '#B8923A' }}>{clinicPhone}</a>
            </p>
          )}
        </div>
        <div className="mt-6 text-center">
          <Link href="/booking" className="text-sm underline" style={{ color: '#666666' }}>
            トップに戻る
          </Link>
        </div>
      </div>
    )
  }

  // Calendar rendering
  const [calYear, calMonth] = currentMonth.split('-').map(Number)
  const firstDay = new Date(calYear, calMonth - 1, 1)
  const lastDay = new Date(calYear, calMonth, 0)
  const startDow = firstDay.getDay()

  const calendarCells: { date: string; day: number; available: boolean; inMonth: boolean }[] = []
  for (let i = 0; i < startDow; i++) {
    calendarCells.push({ date: '', day: 0, available: false, inMonth: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`
    const info = dates.find(dd => dd.date === dateStr)
    calendarCells.push({ date: dateStr, day: d, available: info?.available || false, inMonth: true })
  }

  const nowMonth = new Date()
  const isPrevDisabled = calYear === nowMonth.getFullYear() && calMonth <= nowMonth.getMonth() + 1

  const morningSlots = slots.filter(s => s.period === 'morning')
  const afternoonSlots = slots.filter(s => s.period === 'afternoon')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
          予約の変更
        </h1>
      </div>

      {/* Current appointment */}
      <div className="mx-auto mt-6 max-w-md">
        <p className="mb-2 text-sm" style={{ color: '#666666' }}>現在のご予約:</p>
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: '#F8F5F0', border: '1px solid #E8E0D0' }}
        >
          <p className="text-sm font-medium" style={{ color: '#333333' }}>
            {formatDateTime(appointment.start_time)}〜
          </p>
          <p className="mt-1 text-sm" style={{ color: '#666666' }}>
            {appointment.booking_type_name}（{appointment.duration_minutes}分）
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm" style={{ color: '#666666' }}>
        新しい日時をお選びください
      </p>

      {/* Calendar */}
      <div className="mt-4 rounded-lg p-4" style={{ border: '1px solid #E8E0D0' }}>
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            disabled={isPrevDisabled}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#333" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-medium" style={{ color: '#333333' }}>
            {calYear}年{calMonth}月
          </span>
          <button onClick={handleNextMonth} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#333" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium" style={{ color: '#666666' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {datesLoading ? (
            Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="flex h-10 items-center justify-center rounded-md">
                <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              </div>
            ))
          ) : (
            calendarCells.map((cell, i) => {
              if (!cell.inMonth) return <div key={i} className="h-10" />
              const isSelected = cell.date === selectedDate
              const dayOfWeek = new Date(cell.date + 'T00:00:00').getDay()

              return (
                <button
                  key={i}
                  disabled={!cell.available}
                  onClick={() => {
                    setSelectedDate(cell.date)
                    setSelectedTime(null)
                  }}
                  className="flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors disabled:cursor-default"
                  style={{
                    backgroundColor: isSelected
                      ? '#B8923A'
                      : cell.available
                        ? '#B8923A1A'
                        : dayOfWeek === 0 ? '#FECACA' : dayOfWeek === 6 ? '#BFDBFE' : '#F3F4F6',
                    color: isSelected
                      ? '#FFFFFF'
                      : cell.available ? '#333333' : '#9CA3AF',
                  }}
                >
                  {cell.day}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mt-6 rounded-lg p-4" style={{ border: '1px solid #E8E0D0' }}>
          <h3 className="mb-3 text-center text-sm font-medium" style={{ color: '#333333' }}>
            {(() => {
              const d = new Date(selectedDate + 'T00:00:00')
              const m = d.getMonth() + 1
              const day = d.getDate()
              const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
              return `${m}月${day}日（${dow}）の空き時間`
            })()}
          </h3>

          {slotsLoading ? (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-11 w-16 animate-pulse rounded-md bg-gray-200" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-center text-sm" style={{ color: '#999999' }}>
              この日は空きがありません
            </p>
          ) : (
            <>
              {morningSlots.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-medium" style={{ color: '#666666' }}>午前</p>
                  <div className="flex flex-wrap gap-2">
                    {morningSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className="min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: selectedTime === slot.time ? '#B8923A' : '#FFFFFF',
                          borderColor: selectedTime === slot.time ? '#B8923A' : '#E8E0D0',
                          color: selectedTime === slot.time ? '#FFFFFF' : '#333333',
                        }}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afternoonSlots.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium" style={{ color: '#666666' }}>午後</p>
                  <div className="flex flex-wrap gap-2">
                    {afternoonSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className="min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: selectedTime === slot.time ? '#B8923A' : '#FFFFFF',
                          borderColor: selectedTime === slot.time ? '#B8923A' : '#E8E0D0',
                          color: selectedTime === slot.time ? '#FFFFFF' : '#333333',
                        }}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Selection summary + change button */}
      {selectedDate && selectedTime && (
        <div className="mt-6 text-center">
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: '#F8F5F0' }}>
            <p className="text-sm font-medium" style={{ color: '#333333' }}>
              {formatSelectedDateTime()}
            </p>
          </div>

          {changeError && (
            <p className="mb-3 text-sm text-red-600">{changeError}</p>
          )}

          <button
            onClick={handleChange}
            disabled={changing}
            className="min-h-[48px] w-full rounded-lg px-8 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#B8923A' }}
          >
            {changing ? '変更中...' : 'この日時に変更する'}
          </button>
        </div>
      )}

      {/* Cancel link */}
      <div className="mt-4 text-center">
        <Link
          href={`/booking/confirm/${token}`}
          className="text-sm underline"
          style={{ color: '#666666' }}
        >
          やっぱりやめる
        </Link>
      </div>
    </div>
  )
}
