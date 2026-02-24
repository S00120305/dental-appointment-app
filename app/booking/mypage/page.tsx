'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type UpcomingAppointment = {
  id: string
  start_time: string
  duration_minutes: number
  status: string
  appointment_type: string
  booking_token: string | null
  can_change: boolean
}

type UnusedToken = {
  token: string
  booking_type_name: string
  duration_minutes: number
  expires_at: string
}

type PastAppointment = {
  id: string
  start_time: string
  duration_minutes: number
  appointment_type: string
}

type MypageData = {
  patient: { name: string }
  upcoming_appointments: UpcomingAppointment[]
  unused_tokens: UnusedToken[]
  past_appointments: PastAppointment[]
  cancel_deadline_time: string
  clinic_phone: string
}

export default function BookingMypagePage() {
  const router = useRouter()
  const [data, setData] = useState<MypageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const stored = sessionStorage.getItem('booking_auth')
    if (!stored) {
      router.replace('/booking')
      return
    }

    const { chart_number, phone } = JSON.parse(stored)

    try {
      const res = await fetch('/api/booking/mypage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart_number, phone }),
      })
      const result = await res.json()

      if (res.ok) {
        setData(result)
      } else {
        setError(result.error || 'データの取得に失敗しました')
        sessionStorage.removeItem('booking_auth')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleLogout = () => {
    sessionStorage.removeItem('booking_auth')
    router.replace('/booking')
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
    return `${d.getMonth() + 1}/${d.getDate()}まで`
  }

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

  if (error || !data) {
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
        <p className="text-sm" style={{ color: '#666666' }}>{error}</p>
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Patient name */}
      <div className="mb-6 text-center">
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
          {data.patient.name} 様
        </h1>
      </div>

      {/* Upcoming appointments */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium" style={{ color: '#333333' }}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#B8923A">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          今後のご予約
        </h2>

        {data.upcoming_appointments.length === 0 ? (
          <div className="rounded-lg p-4 text-center text-sm" style={{ backgroundColor: '#F8F5F0', color: '#999999' }}>
            今後の予約はありません
          </div>
        ) : (
          <div className="space-y-3">
            {data.upcoming_appointments.map((a) => (
              <div
                key={a.id}
                className="rounded-lg p-4"
                style={{ border: '1px solid #E8E0D0' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#333333' }}>
                      {formatDateTime(a.start_time)}〜
                    </p>
                    <p className="mt-1 text-sm" style={{ color: '#666666' }}>
                      {a.appointment_type}（{a.duration_minutes}分）
                    </p>
                    {a.status === 'pending' && (
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: '#D976061A', color: '#D97706' }}
                      >
                        承認待ち
                      </span>
                    )}
                  </div>
                </div>

                {a.can_change && a.booking_token ? (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/booking/change/${a.booking_token}`}
                      className="flex-1 rounded-lg border py-2.5 text-center text-sm font-medium transition-colors"
                      style={{ borderColor: '#B8923A', color: '#B8923A' }}
                    >
                      変更する
                    </Link>
                    <Link
                      href={`/booking/cancel/${a.booking_token}`}
                      className="flex-1 rounded-lg border py-2.5 text-center text-sm font-medium transition-colors"
                      style={{ borderColor: '#DC2626', color: '#DC2626' }}
                    >
                      キャンセルする
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-xs" style={{ color: '#999999' }}>
                    変更・キャンセルの受付期限を過ぎています。
                    {data.clinic_phone && (
                      <>お電話（<a href={`tel:${data.clinic_phone.replace(/-/g, '')}`} style={{ color: '#B8923A' }}>{data.clinic_phone}</a>）にてご連絡ください。</>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unused tokens */}
      {data.unused_tokens.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-medium" style={{ color: '#333333' }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#B8923A">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            次回予約のご案内（未予約）
          </h2>
          <div className="space-y-3">
            {data.unused_tokens.map((t) => (
              <div
                key={t.token}
                className="rounded-lg p-4"
                style={{ border: '1px solid #E8E0D0' }}
              >
                <p className="text-sm font-medium" style={{ color: '#333333' }}>
                  {t.booking_type_name}（{t.duration_minutes}分）
                </p>
                <p className="mt-1 text-xs" style={{ color: '#999999' }}>
                  期限: {formatExpiry(t.expires_at)}
                </p>
                <Link
                  href={`/booking/token/${t.token}`}
                  className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 text-sm font-medium text-white"
                  style={{ backgroundColor: '#B8923A' }}
                >
                  日時を選ぶ
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past appointments */}
      {data.past_appointments.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-medium" style={{ color: '#333333' }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#B8923A">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            過去のご予約（直近5件）
          </h2>
          <div className="space-y-1">
            {data.past_appointments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                style={{ backgroundColor: '#F8F5F0' }}
              >
                <span style={{ color: '#666666' }}>
                  {formatDateTime(a.start_time)} {a.appointment_type}
                </span>
                <span className="text-xs" style={{ color: '#2D8A4E' }}>
                  完了
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Logout */}
      <div className="text-center">
        <button
          onClick={handleLogout}
          className="min-h-[48px] rounded-lg border px-8 text-sm font-medium transition-colors"
          style={{ borderColor: '#E8E0D0', color: '#666666' }}
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
