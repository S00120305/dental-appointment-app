'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { cleanPhone } from '@/lib/utils/phone'

// Types
type BookingType = {
  id: string
  display_name: string
  description: string | null
  duration_minutes: number
  confirmation_mode: 'instant' | 'approval'
}

type DateInfo = {
  date: string
  available: boolean
}

type SlotInfo = {
  time: string
  period: 'morning' | 'afternoon'
}

type Step = 1 | 2 | 3 | 4
type PageState = { kind: 'flow'; step: Step } | { kind: 'complete'; token: string; autoConfirmed: boolean }

const STEP_LABELS = ['予約種別', '日付選択', '時間選択', '情報入力']
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

export default function BookingNewPage() {
  const router = useRouter()
  const { showToast } = useToast()

  // Page state
  const [pageState, setPageState] = useState<PageState>({ kind: 'flow', step: 1 })

  // Selections
  const [selectedType, setSelectedType] = useState<BookingType | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Data
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([])
  const [dates, setDates] = useState<DateInfo[]>([])
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Form
  const [patientLastName, setPatientLastName] = useState('')
  const [patientFirstName, setPatientFirstName] = useState('')
  const [patientLastNameKana, setPatientLastNameKana] = useState('')
  const [patientFirstNameKana, setPatientFirstNameKana] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [memo, setMemo] = useState('')
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  // Loading
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [loadingDates, setLoadingDates] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentStep = pageState.kind === 'flow' ? pageState.step : 0

  // Fetch booking types
  useEffect(() => {
    if (currentStep !== 1) return
    setLoadingTypes(true)
    fetch('/api/booking/types')
      .then((r) => r.json())
      .then((data) => {
        setBookingTypes(data.booking_types || [])
      })
      .catch(() => showToast('予約種別の取得に失敗しました', 'error'))
      .finally(() => setLoadingTypes(false))
  }, [currentStep, showToast])

  // Fetch available dates
  const fetchDates = useCallback(
    (month: string) => {
      if (!selectedType) return
      setLoadingDates(true)
      fetch(
        `/api/booking/available-dates?type_id=${selectedType.id}&month=${month}`
      )
        .then((r) => r.json())
        .then((data) => {
          setDates(data.dates || [])
        })
        .catch(() => showToast('カレンダー情報の取得に失敗しました', 'error'))
        .finally(() => setLoadingDates(false))
    },
    [selectedType, showToast]
  )

  useEffect(() => {
    if (currentStep === 2 && selectedType) {
      fetchDates(currentMonth)
    }
  }, [currentStep, currentMonth, selectedType, fetchDates])

  // Fetch available slots
  useEffect(() => {
    if (currentStep !== 3 || !selectedType || !selectedDate) return
    setLoadingSlots(true)
    fetch(
      `/api/booking/available-slots?type_id=${selectedType.id}&date=${selectedDate}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || [])
      })
      .catch(() => showToast('時間枠の取得に失敗しました', 'error'))
      .finally(() => setLoadingSlots(false))
  }, [currentStep, selectedType, selectedDate, showToast])

  // Navigation
  const goToStep = (step: Step) => {
    setPageState({ kind: 'flow', step })
  }

  const handleBack = () => {
    if (currentStep === 1) {
      router.push('/booking')
    } else if (currentStep > 1) {
      goToStep((currentStep - 1) as Step)
    }
  }

  // Step 1: Select type
  const handleSelectType = (type: BookingType) => {
    setSelectedType(type)
    setSelectedDate(null)
    setSelectedTime(null)
    goToStep(2)
  }

  // Step 2: Select date
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedTime(null)
    goToStep(3)
  }

  // Step 3: Select time
  const handleSelectTime = (time: string) => {
    setSelectedTime(time)
    goToStep(4)
  }

  // Step 4: Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !selectedDate || !selectedTime) return

    if (!patientLastName.trim()) {
      showToast('お名前（姓）を入力してください', 'error')
      return
    }
    if (!phone.trim()) {
      showToast('電話番号を入力してください', 'error')
      return
    }
    const phoneClean = cleanPhone(phone)
    if (!/^0\d{9,10}$/.test(phoneClean)) {
      showToast('電話番号の形式が正しくありません', 'error')
      return
    }
    if (!agreePrivacy) {
      showToast('個人情報の取り扱いに同意してください', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/booking/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_type_id: selectedType.id,
          date: selectedDate,
          time: selectedTime,
          patient_last_name: patientLastName.trim(),
          patient_first_name: patientFirstName.trim() || undefined,
          patient_last_name_kana: patientLastNameKana.trim() || undefined,
          patient_first_name_kana: patientFirstNameKana.trim() || undefined,
          phone: phoneClean,
          email: email.trim() || undefined,
          memo: memo.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || '予約に失敗しました', 'error')
        return
      }

      setPageState({
        kind: 'complete',
        token: data.token,
        autoConfirmed: data.auto_confirmed,
      })
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    setCurrentMonth(
      `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    )
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = new Date(y, m, 1)
    setCurrentMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    )
  }

  // Format helpers
  const formatDateJP = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(`${dateStr}T00:00:00+09:00`)
    const dow = DAY_NAMES[date.getUTCDay()]
    return `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`
  }

  // ====== Render Complete Screen ======
  if (pageState.kind === 'complete') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center">
          {/* Success icon */}
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              backgroundColor: pageState.autoConfirmed ? '#2D8A4E1A' : '#D976061A',
            }}
          >
            {pageState.autoConfirmed ? (
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#2D8A4E"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            ) : (
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#D97706"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            )}
          </div>

          <h1
            className="text-xl font-medium"
            style={{ color: '#333333' }}
          >
            {pageState.autoConfirmed
              ? 'ご予約が確定しました'
              : 'ご予約リクエストを受け付けました'}
          </h1>

          {!pageState.autoConfirmed && (
            <p className="mt-3 text-sm" style={{ color: '#666666' }}>
              スタッフが確認後、ご予約が確定されます。
              <br />
              確定次第、ご登録のメールアドレスにお知らせいたします。
            </p>
          )}

          {/* Booking details */}
          <div
            className="mx-auto mt-6 max-w-md rounded-lg p-6 text-left"
            style={{ backgroundColor: '#F8F5F0' }}
          >
            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: '#333333' }}
            >
              予約内容
            </h3>
            <div className="space-y-2 text-sm" style={{ color: '#666666' }}>
              <div className="flex justify-between">
                <span>予約種別</span>
                <span style={{ color: '#333333' }}>
                  {selectedType?.display_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span>日時</span>
                <span style={{ color: '#333333' }}>
                  {selectedDate && formatDateJP(selectedDate)} {selectedTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span>所要時間</span>
                <span style={{ color: '#333333' }}>
                  約{selectedType?.duration_minutes}分
                </span>
              </div>
              <div className="flex justify-between">
                <span>ステータス</span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: pageState.autoConfirmed
                      ? '#2D8A4E1A'
                      : '#D976061A',
                    color: pageState.autoConfirmed ? '#2D8A4E' : '#D97706',
                  }}
                >
                  {pageState.autoConfirmed ? '確定' : '承認待ち'}
                </span>
              </div>
            </div>
          </div>

          {/* Confirm page link */}
          <div className="mt-6">
            <Link
              href={`/booking/confirm/${pageState.token}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border px-8 text-sm font-medium transition-colors"
              style={{ borderColor: '#B8923A', color: '#B8923A' }}
            >
              予約確認ページを見る
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/booking"
              className="text-sm underline"
              style={{ color: '#666666' }}
            >
              トップに戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ====== Render Flow ======
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isActive = stepNum === currentStep
            const isDone = stepNum < currentStep
            return (
              <div key={label} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{
                        backgroundColor: isDone || isActive ? '#B8923A' : '#E8E0D0',
                      }}
                    />
                  )}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                    style={{
                      backgroundColor:
                        isActive || isDone ? '#B8923A' : '#E8E0D0',
                      color: isActive || isDone ? '#FFFFFF' : '#999999',
                    }}
                  >
                    {isDone ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{
                        backgroundColor: isDone ? '#B8923A' : '#E8E0D0',
                      }}
                    />
                  )}
                </div>
                <span
                  className="mt-1.5 text-xs"
                  style={{
                    color: isActive ? '#B8923A' : isDone ? '#333333' : '#999999',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={handleBack}
        className="mb-4 flex items-center gap-1 text-sm"
        style={{ color: '#666666' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        戻る
      </button>

      {/* Step 1: Booking Type */}
      {currentStep === 1 && (
        <div>
          <h2 className="mb-4 text-lg font-medium" style={{ color: '#333333' }}>
            予約種別を選択してください
          </h2>

          {loadingTypes ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg"
                  style={{ backgroundColor: '#F8F5F0' }}
                />
              ))}
            </div>
          ) : bookingTypes.length === 0 ? (
            <p className="text-sm" style={{ color: '#666666' }}>
              現在Web予約可能な予約種別がありません。お電話にてご予約ください。
            </p>
          ) : (
            <div className="space-y-3">
              {bookingTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type)}
                  className="w-full rounded-lg p-5 text-left transition-all"
                  style={{
                    border: '1px solid #E8E0D0',
                    backgroundColor: '#FFFFFF',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = '#B8923A')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = '#E8E0D0')
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-base font-medium"
                          style={{ color: '#333333' }}
                        >
                          {type.display_name}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor:
                              type.confirmation_mode === 'instant'
                                ? '#2D8A4E1A'
                                : '#D976061A',
                            color:
                              type.confirmation_mode === 'instant'
                                ? '#2D8A4E'
                                : '#D97706',
                          }}
                        >
                          {type.confirmation_mode === 'instant'
                            ? '即時確定'
                            : 'スタッフ確認後に確定'}
                        </span>
                      </div>
                      {type.description && (
                        <p
                          className="mt-1 text-sm"
                          style={{ color: '#666666' }}
                        >
                          {type.description}
                        </p>
                      )}
                      <p
                        className="mt-1 text-xs"
                        style={{ color: '#999999' }}
                      >
                        所要時間: 約{type.duration_minutes}分
                      </p>
                    </div>
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="#B8923A"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Date Selection (Calendar) */}
      {currentStep === 2 && (
        <div>
          <h2 className="mb-4 text-lg font-medium" style={{ color: '#333333' }}>
            日付を選択してください
          </h2>
          <p className="mb-4 text-sm" style={{ color: '#666666' }}>
            {selectedType?.display_name} （約{selectedType?.duration_minutes}分）
          </p>

          <CalendarGrid
            currentMonth={currentMonth}
            dates={dates}
            selectedDate={selectedDate}
            loading={loadingDates}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        </div>
      )}

      {/* Step 3: Time Slot Selection */}
      {currentStep === 3 && (
        <div>
          <h2 className="mb-2 text-lg font-medium" style={{ color: '#333333' }}>
            時間を選択してください
          </h2>
          <p className="mb-6 text-sm" style={{ color: '#666666' }}>
            {selectedDate && formatDateJP(selectedDate)} ・ {selectedType?.display_name}
          </p>

          {loadingSlots ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-lg" style={{ backgroundColor: '#F8F5F0' }} />
              <div className="h-32 animate-pulse rounded-lg" style={{ backgroundColor: '#F8F5F0' }} />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm" style={{ color: '#666666' }}>
              この日に空きがありません。別の日付を選択してください。
            </p>
          ) : (
            <div className="space-y-6">
              {/* Morning */}
              {slots.some((s) => s.period === 'morning') && (
                <div>
                  <h3
                    className="mb-3 flex items-center gap-2 text-sm font-medium"
                    style={{ color: '#333333' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#B8923A">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                    午前
                  </h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {slots
                      .filter((s) => s.period === 'morning')
                      .map((slot) => (
                        <TimeSlotButton
                          key={slot.time}
                          time={slot.time}
                          selected={selectedTime === slot.time}
                          onClick={() => handleSelectTime(slot.time)}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Afternoon */}
              {slots.some((s) => s.period === 'afternoon') && (
                <div>
                  <h3
                    className="mb-3 flex items-center gap-2 text-sm font-medium"
                    style={{ color: '#333333' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#B8923A">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                    </svg>
                    午後
                  </h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {slots
                      .filter((s) => s.period === 'afternoon')
                      .map((slot) => (
                        <TimeSlotButton
                          key={slot.time}
                          time={slot.time}
                          selected={selectedTime === slot.time}
                          onClick={() => handleSelectTime(slot.time)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Patient Info + Confirm */}
      {currentStep === 4 && (
        <div>
          <h2 className="mb-4 text-lg font-medium" style={{ color: '#333333' }}>
            ご予約情報を入力してください
          </h2>

          {/* Selected summary */}
          <div
            className="mb-6 rounded-lg p-4"
            style={{ backgroundColor: '#F8F5F0' }}
          >
            <div className="space-y-1 text-sm" style={{ color: '#666666' }}>
              <div className="flex justify-between">
                <span>予約種別</span>
                <span style={{ color: '#333333' }}>{selectedType?.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span>日時</span>
                <span style={{ color: '#333333' }}>
                  {selectedDate && formatDateJP(selectedDate)} {selectedTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span>所要時間</span>
                <span style={{ color: '#333333' }}>約{selectedType?.duration_minutes}分</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                  姓 <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={patientLastName}
                  onChange={(e) => setPatientLastName(e.target.value)}
                  placeholder="例: 山田"
                  required
                  className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                  style={{ borderColor: '#E8E0D0', color: '#333333' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                  名
                </label>
                <input
                  type="text"
                  value={patientFirstName}
                  onChange={(e) => setPatientFirstName(e.target.value)}
                  placeholder="例: 太郎"
                  className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                  style={{ borderColor: '#E8E0D0', color: '#333333' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
              </div>
            </div>

            {/* Kana */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                  セイ
                </label>
                <input
                  type="text"
                  value={patientLastNameKana}
                  onChange={(e) => setPatientLastNameKana(e.target.value)}
                  placeholder="例: ヤマダ"
                  className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                  style={{ borderColor: '#E8E0D0', color: '#333333' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                  メイ
                </label>
                <input
                  type="text"
                  value={patientFirstNameKana}
                  onChange={(e) => setPatientFirstNameKana(e.target.value)}
                  placeholder="例: タロウ"
                  className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                  style={{ borderColor: '#E8E0D0', color: '#333333' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                電話番号 <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例: 090-1234-5678"
                required
                className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                style={{ borderColor: '#E8E0D0', color: '#333333' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例: taro@example.com"
                className="w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                style={{ borderColor: '#E8E0D0', color: '#333333' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
              />
              <p className="mt-1 text-xs" style={{ color: '#999999' }}>
                予約確認メールをお送りします
              </p>
            </div>

            {/* Memo */}
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#333333' }}>
                備考・ご要望
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="症状やご要望がございましたらご記入ください"
                rows={3}
                className="w-full resize-none rounded-lg border px-4 py-3 text-base outline-none transition-colors"
                style={{ borderColor: '#E8E0D0', color: '#333333' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
              />
            </div>

            {/* Privacy agreement */}
            <label className="flex cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#B8923A]"
              />
              <span className="text-sm" style={{ color: '#333333' }}>
                個人情報の取り扱いに同意する
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !agreePrivacy}
              className="min-h-[48px] w-full rounded-lg text-base font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: '#B8923A' }}
              onMouseEnter={(e) => {
                if (!submitting && agreePrivacy)
                  e.currentTarget.style.backgroundColor = '#A07D2E'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#B8923A'
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  予約を送信中...
                </span>
              ) : (
                '予約を確定する'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ====== Calendar Grid Component ======
function CalendarGrid({
  currentMonth,
  dates,
  selectedDate,
  loading,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  currentMonth: string
  dates: DateInfo[]
  selectedDate: string | null
  loading: boolean
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const [y, m] = currentMonth.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  const startDow = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // Build a lookup for available dates
  const dateMap = new Map<string, boolean>()
  for (const d of dates) {
    dateMap.set(d.date, d.available)
  }

  // Build grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad the rest
  while (cells.length % 7 !== 0) cells.push(null)

  // Min month check (can't go before current month)
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const canGoPrev = currentMonth > currentYM

  return (
    <div
      className="rounded-lg p-4"
      style={{ border: '1px solid #E8E0D0' }}
    >
      {/* Month header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30"
          style={{ color: '#B8923A' }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-base font-medium" style={{ color: '#333333' }}>
          {y}年{m}月
        </span>
        <button
          onClick={onNextMonth}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          style={{ color: '#B8923A' }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium"
            style={{
              color:
                name === '日' ? '#DC2626' : name === '土' ? '#2563EB' : '#666666',
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#B8923A" strokeWidth="4" />
            <path className="opacity-75" fill="#B8923A" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="p-1" />
            }

            const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`
            const isAvailable = dateMap.get(dateStr) === true
            const isSelected = selectedDate === dateStr
            const dow = (startDow + day - 1) % 7

            return (
              <div key={dateStr} className="flex items-center justify-center p-1">
                <button
                  disabled={!isAvailable}
                  onClick={() => onSelectDate(dateStr)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm transition-all disabled:cursor-default"
                  style={{
                    backgroundColor: isSelected
                      ? '#B8923A'
                      : isAvailable
                        ? '#B8923A1A'
                        : 'transparent',
                    color: isSelected
                      ? '#FFFFFF'
                      : isAvailable
                        ? '#B8923A'
                        : dow === 0
                          ? '#FECACA'
                          : dow === 6
                            ? '#BFDBFE'
                            : '#D1D5DB',
                    fontWeight: isAvailable ? 500 : 400,
                  }}
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ====== Time Slot Button Component ======
function TimeSlotButton({
  time,
  selected,
  onClick,
}: {
  time: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-[44px] rounded-lg text-sm font-medium transition-all"
      style={{
        border: `1.5px solid ${selected ? '#B8923A' : '#E8E0D0'}`,
        backgroundColor: selected ? '#B8923A' : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#333333',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#B8923A'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#E8E0D0'
      }}
    >
      {time}
    </button>
  )
}
