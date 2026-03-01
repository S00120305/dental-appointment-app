'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TokenInfo = {
  token: string
  patient_name: string
  booking_type_id: string
  booking_type_name: string
  duration_minutes: number
  staff_id: string | null
  staff_name: string | null
  unit_number: number | null
  expires_at: string
}

type DateInfo = { date: string; available: boolean }
type SlotInfo = { time: string; period: 'morning' | 'afternoon' }

type ErrorInfo = {
  code: 'invalid' | 'used' | 'expired'
  message: string
  confirm_token?: string
}

export default function TokenBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [loading, setLoading] = useState(true)

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

  // Booking state
  const [reserving, setReserving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [confirmToken, setConfirmToken] = useState<string | null>(null)
  const [reserveError, setReserveError] = useState<string | null>(null)

  // Fetch token info
  useEffect(() => {
    fetch(`/api/booking-tokens/${token}`)
      .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setTokenInfo(data)
        } else {
          setErrorInfo({
            code: data.code || 'invalid',
            message: data.error || 'このご案内番号は無効です',
            confirm_token: data.confirm_token,
          })
        }
      })
      .catch(() => {
        setErrorInfo({ code: 'invalid', message: '通信エラーが発生しました' })
      })
      .finally(() => setLoading(false))
  }, [token])

  // 使用済みトークン → 確認ページに自動リダイレクト
  useEffect(() => {
    if (errorInfo?.code === 'used' && errorInfo.confirm_token) {
      router.replace(`/booking/confirm/${errorInfo.confirm_token}`)
    }
  }, [errorInfo, router])

  // Fetch available dates when month or tokenInfo changes
  useEffect(() => {
    if (!tokenInfo) return
    setDatesLoading(true)
    fetch(`/api/booking/available-dates?type_id=${tokenInfo.booking_type_id}&month=${currentMonth}&source=token&duration=${tokenInfo.duration_minutes}`)
      .then(res => res.json())
      .then(data => {
        setDates(data.dates || [])
      })
      .catch(() => setDates([]))
      .finally(() => setDatesLoading(false))
  }, [tokenInfo, currentMonth])

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!tokenInfo || !selectedDate) return
    setSlotsLoading(true)
    setSelectedTime(null)
    fetch(`/api/booking/available-slots?type_id=${tokenInfo.booking_type_id}&date=${selectedDate}&source=token&duration=${tokenInfo.duration_minutes}`)
      .then(res => res.json())
      .then(data => {
        setSlots(data.slots || [])
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [tokenInfo, selectedDate])

  const handleReserve = async () => {
    if (!selectedDate || !selectedTime) return
    setReserving(true)
    setReserveError(null)

    try {
      const res = await fetch(`/api/booking-tokens/${token}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: selectedTime }),
      })
      const data = await res.json()

      if (res.ok) {
        setCompleted(true)
        setConfirmToken(data.booking_token)
      } else {
        setReserveError(data.error || '予約に失敗しました')
      }
    } catch {
      setReserveError('通信エラーが発生しました')
    } finally {
      setReserving(false)
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

  const formatSelectedDateTime = () => {
    if (!selectedDate || !selectedTime) return ''
    const d = new Date(`${selectedDate}T${selectedTime}:00+09:00`)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()]
    const endMinutes = (tokenInfo?.duration_minutes || 30)
    const endDate = new Date(d.getTime() + endMinutes * 60 * 1000)
    const endH = String((endDate.getUTCHours() + 9) % 24).padStart(2, '0')
    const endM = String(endDate.getUTCMinutes()).padStart(2, '0')
    return `${m}月${day}日（${dow}）${selectedTime}〜${endH}:${endM}`
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="animate-pulse">
          <div className="mx-auto h-6 w-48 rounded bg-gray-200" />
          <div className="mx-auto mt-4 h-4 w-64 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  // Error states
  if (errorInfo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: '#FEF2F2' }}>
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#DC2626">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-medium" style={{ color: '#333333' }}>{errorInfo.message}</p>
        {errorInfo.code === 'used' && errorInfo.confirm_token && (
          <Link
            href={`/booking/confirm/${errorInfo.confirm_token}`}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white"
            style={{ backgroundColor: '#B8923A' }}
          >
            予約を確認する
          </Link>
        )}
        {errorInfo.code === 'expired' && (
          <Link
            href="/booking"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg border px-8 text-sm font-medium"
            style={{ borderColor: '#B8923A', color: '#B8923A' }}
          >
            トップに戻る
          </Link>
        )}
      </div>
    )
  }

  // Completion
  if (completed && tokenInfo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: '#F0FDF4' }}>
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2D8A4E">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-medium" style={{ color: '#333333' }}>ご予約が確定しました</h2>
        <div className="mx-auto mt-6 max-w-sm rounded-lg p-4" style={{ backgroundColor: '#F8F5F0' }}>
          <p className="text-sm font-medium" style={{ color: '#333333' }}>{tokenInfo.booking_type_name}（{tokenInfo.duration_minutes}分）</p>
          <p className="mt-1 text-sm" style={{ color: '#333333' }}>{formatSelectedDateTime()}</p>
          {tokenInfo.staff_name && (
            <p className="mt-1 text-sm" style={{ color: '#666666' }}>担当: {tokenInfo.staff_name}</p>
          )}
        </div>
        {confirmToken && (
          <div className="mt-6">
            <p className="text-sm" style={{ color: '#666666' }}>予約の確認はこちら:</p>
            <Link
              href={`/booking/confirm/${confirmToken}`}
              className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white"
              style={{ backgroundColor: '#B8923A' }}
            >
              予約を確認する
            </Link>
          </div>
        )}
        <Link
          href="/booking"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg border px-8 text-sm font-medium"
          style={{ borderColor: '#B8923A', color: '#B8923A' }}
        >
          トップに戻る
        </Link>
      </div>
    )
  }

  if (!tokenInfo) return null

  // Calendar rendering
  const [calYear, calMonth] = currentMonth.split('-').map(Number)
  const firstDay = new Date(calYear, calMonth - 1, 1)
  const lastDay = new Date(calYear, calMonth, 0)
  const startDow = firstDay.getDay()

  const calendarCells: { date: string; day: number; available: boolean; inMonth: boolean }[] = []
  // Pad with empty cells
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
      {/* Token info header */}
      <div className="mb-6 text-center">
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
          {tokenInfo.patient_name}様の次回予約
        </h1>
      </div>

      {/* Booking type card */}
      <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: '#F8F5F0', border: '1px solid #E8E0D0' }}>
        <p className="text-sm font-medium" style={{ color: '#333333' }}>
          {tokenInfo.booking_type_name}（{tokenInfo.duration_minutes}分）
        </p>
        {tokenInfo.staff_name && (
          <p className="mt-1 text-sm" style={{ color: '#666666' }}>担当: {tokenInfo.staff_name}</p>
        )}
      </div>

      <p className="mb-4 text-center text-sm" style={{ color: '#666666' }}>
        ご都合のよい日時をお選びください
      </p>

      {/* Calendar */}
      <div className="rounded-lg p-4" style={{ border: '1px solid #E8E0D0' }}>
        {/* Month navigation */}
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

        {/* Day headers */}
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium" style={{ color: '#666666' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {datesLoading ? (
            Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="flex h-10 items-center justify-center rounded-md">
                <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              </div>
            ))
          ) : (
            calendarCells.map((cell, i) => {
              if (!cell.inMonth) {
                return <div key={i} className="h-10" />
              }
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
                        : dayOfWeek === 0
                          ? '#FECACA'
                          : dayOfWeek === 6
                            ? '#BFDBFE'
                            : '#F3F4F6',
                    color: isSelected
                      ? '#FFFFFF'
                      : cell.available
                        ? '#333333'
                        : '#9CA3AF',
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

      {/* Selection summary + reserve button */}
      {selectedDate && selectedTime && (
        <div className="mt-6 text-center">
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: '#F8F5F0' }}>
            <p className="text-sm font-medium" style={{ color: '#333333' }}>
              {formatSelectedDateTime()}
            </p>
          </div>

          {reserveError && (
            <p className="mb-3 text-sm text-red-600">{reserveError}</p>
          )}

          <button
            onClick={handleReserve}
            disabled={reserving}
            className="min-h-[48px] w-full rounded-lg px-8 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#B8923A' }}
          >
            {reserving ? '予約中...' : 'この日時で予約する'}
          </button>
        </div>
      )}
    </div>
  )
}
