'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

type PatientResult = {
  patient_name: string
  tokens: Array<{
    token: string
    booking_type_name: string
    duration_minutes: number
    staff_name: string | null
    expires_at: string
  }>
  appointments: Array<{
    id: string
    start_time: string
    duration_minutes: number
    status: string
    appointment_type: string
    booking_token: string | null
  }>
}

export default function BookingTopPage() {
  const { showToast } = useToast()
  const [chartNumber, setChartNumber] = useState('')
  const [lookupPhone, setLookupPhone] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [patientResult, setPatientResult] = useState<PatientResult | null>(null)
  const [tokenInput, setTokenInput] = useState('')

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chartNumber.trim() || !lookupPhone.trim()) {
      showToast('診察券番号と電話番号を入力してください', 'error')
      return
    }
    setLookupLoading(true)
    setPatientResult(null)
    try {
      const phone = lookupPhone.replace(/[-\s]/g, '')
      const res = await fetch(`/api/booking-tokens/patient?chart_number=${encodeURIComponent(chartNumber.trim())}&phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (res.ok) {
        setPatientResult(data)
      } else {
        showToast(data.error || '該当する患者が見つかりません', 'error')
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleTokenLookup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) {
      showToast('ご案内番号を入力してください', 'error')
      return
    }
    window.location.href = `/booking/token/${tokenInput.trim()}`
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

  const formatExpiry = (expiresAt: string) => {
    const d = new Date(expiresAt)
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${m}/${day}まで`
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Page Title */}
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-light tracking-wide"
          style={{ color: '#333333' }}
        >
          Web予約
        </h1>
        <p className="mt-2 text-sm" style={{ color: '#666666' }}>
          24時間いつでもご予約いただけます
        </p>
      </div>

      <div className="space-y-6">
        {/* Card 1: New Booking */}
        <div
          className="rounded-lg p-6"
          style={{
            border: '1px solid #E8E0D0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#B8923A1A' }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#B8923A"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2
                className="text-lg font-medium"
                style={{ color: '#333333' }}
              >
                新規のご予約
              </h2>
              <p className="mt-1 text-sm" style={{ color: '#666666' }}>
                ご希望の日時・診療内容を選択して予約できます
              </p>
              <Link
                href="/booking/new"
                className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#B8923A' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#A07D2E')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = '#B8923A')
                }
              >
                予約する
              </Link>
            </div>
          </div>
        </div>

        {/* Card 2: Check/Change Booking */}
        <div
          className="rounded-lg p-6"
          style={{
            border: '1px solid #E8E0D0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#B8923A1A' }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#B8923A"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2
                className="text-lg font-medium"
                style={{ color: '#333333' }}
              >
                ご予約の確認・変更
              </h2>
              <p className="mt-1 text-sm" style={{ color: '#666666' }}>
                診察券番号と電話番号でご予約を検索できます
              </p>
              <form onSubmit={handleLookup} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="診察券番号"
                  value={chartNumber}
                  onChange={(e) => setChartNumber(e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    borderColor: '#E8E0D0',
                    color: '#333333',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
                <input
                  type="tel"
                  placeholder="電話番号"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    borderColor: '#E8E0D0',
                    color: '#333333',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="min-h-[48px] w-full rounded-lg border px-8 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    borderColor: '#B8923A',
                    color: '#B8923A',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#B8923A'
                    e.currentTarget.style.color = '#FFFFFF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#B8923A'
                  }}
                >
                  {lookupLoading ? '検索中...' : '検索する'}
                </button>
              </form>

              {/* Patient lookup results */}
              {patientResult && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium" style={{ color: '#333333' }}>
                    {patientResult.patient_name} 様
                  </p>

                  {/* Appointments */}
                  {patientResult.appointments.length > 0 && (
                    <div>
                      <p className="text-xs font-medium" style={{ color: '#666666' }}>ご予約一覧</p>
                      <div className="mt-1 space-y-1">
                        {patientResult.appointments.map(a => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between rounded-md p-2 text-sm"
                            style={{ backgroundColor: '#F8F5F0' }}
                          >
                            <span style={{ color: '#333333' }}>
                              {formatDateTime(a.start_time)} {a.appointment_type}
                            </span>
                            {a.booking_token && (
                              <Link
                                href={`/booking/confirm/${a.booking_token}`}
                                className="text-xs font-medium"
                                style={{ color: '#B8923A' }}
                              >
                                確認
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unused tokens */}
                  {patientResult.tokens.length > 0 && (
                    <div>
                      <p className="text-xs font-medium" style={{ color: '#666666' }}>次回予約のご案内（未予約）</p>
                      <div className="mt-1 space-y-1">
                        {patientResult.tokens.map(t => (
                          <div
                            key={t.token}
                            className="flex items-center justify-between rounded-md p-2 text-sm"
                            style={{ backgroundColor: '#F8F5F0' }}
                          >
                            <span style={{ color: '#333333' }}>
                              {t.booking_type_name}（{t.duration_minutes}分）期限: {formatExpiry(t.expires_at)}
                            </span>
                            <Link
                              href={`/booking/token/${t.token}`}
                              className="text-xs font-medium"
                              style={{ color: '#B8923A' }}
                            >
                              日時を選ぶ
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {patientResult.appointments.length === 0 && patientResult.tokens.length === 0 && (
                    <p className="text-sm" style={{ color: '#999999' }}>
                      現在の予約・ご案内はありません
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Token Booking */}
        <div
          className="rounded-lg p-6"
          style={{
            border: '1px solid #E8E0D0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#B8923A1A' }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#B8923A"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2
                className="text-lg font-medium"
                style={{ color: '#333333' }}
              >
                次回予約のご案内
              </h2>
              <p className="mt-1 text-sm" style={{ color: '#666666' }}>
                ご案内番号をお持ちの方はこちらから予約できます
              </p>
              <form onSubmit={handleTokenLookup} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="ご案内番号"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    borderColor: '#E8E0D0',
                    color: '#333333',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8923A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E8E0D0')}
                />
                <button
                  type="submit"
                  className="min-h-[48px] w-full rounded-lg border px-8 text-sm font-medium transition-colors"
                  style={{
                    borderColor: '#B8923A',
                    color: '#B8923A',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#B8923A'
                    e.currentTarget.style.color = '#FFFFFF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#B8923A'
                  }}
                >
                  確認する
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
