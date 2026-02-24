'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

type AppointmentData = {
  start_time: string
  duration_minutes: number
  status: string
  patient_name: string
  booking_type_name: string
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

export default function BookingConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const { showToast } = useToast()
  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [clinicPhone, setClinicPhone] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return

    setLoading(true)
    Promise.all([
      fetch(`/api/booking/confirm/${token}`).then((r) => r.json()),
      fetch('/api/clinic-settings?keys=clinic_phone').then((r) => r.json()),
    ])
      .then(([confirmData, settingsData]) => {
        if (confirmData.error || !confirmData.appointment) {
          setNotFound(true)
          return
        }
        setAppointment(confirmData.appointment)

        // Extract clinic_phone from settings
        if (settingsData.settings?.clinic_phone) {
          setClinicPhone(settingsData.settings.clinic_phone)
        }
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [token])

  const formatDateTime = (startTime: string) => {
    const date = new Date(startTime)
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const dow = DAY_NAMES[date.getDay()]
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${y}年${m}月${d}日（${dow}） ${hours}:${minutes}`
  }

  const getStatusBadge = (status: string) => {
    if (status === 'scheduled') {
      return {
        label: '確定',
        bg: '#2D8A4E1A',
        color: '#2D8A4E',
      }
    }
    if (status === 'pending') {
      return {
        label: '承認待ち',
        bg: '#D976061A',
        color: '#D97706',
      }
    }
    if (status === 'cancelled') {
      return {
        label: 'キャンセル済み',
        bg: '#DC26261A',
        color: '#DC2626',
      }
    }
    if (status === 'completed') {
      return {
        label: '完了',
        bg: '#6B72801A',
        color: '#6B7280',
      }
    }
    return {
      label: status,
      bg: '#6B72801A',
      color: '#6B7280',
    }
  }

  // Loading state
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: '#DC26261A' }}
          >
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#DC2626">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
            予約が見つかりません
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#666666' }}>
            確認コードが正しくないか、予約が存在しません。
          </p>
          <div className="mt-6">
            <Link
              href="/booking"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white"
              style={{ backgroundColor: '#B8923A' }}
            >
              トップに戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusBadge = getStatusBadge(appointment.status)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
          予約内容の確認
        </h1>
        <p className="mt-2 text-sm" style={{ color: '#666666' }}>
          以下の内容でご予約いただいています
        </p>
      </div>

      {/* Appointment details */}
      <div
        className="mx-auto mt-8 max-w-md rounded-lg p-6"
        style={{ border: '1px solid #E8E0D0' }}
      >
        {/* Status badge */}
        <div className="mb-4 flex justify-center">
          <span
            className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: statusBadge.bg,
              color: statusBadge.color,
            }}
          >
            {statusBadge.label}
          </span>
        </div>

        <div
          className="space-y-4 text-sm"
          style={{ color: '#666666' }}
        >
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: '#F8F5F0' }}
          >
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>お名前</span>
                <span style={{ color: '#333333', fontWeight: 500 }}>
                  {appointment.patient_name}
                </span>
              </div>
              <div
                className="border-t"
                style={{ borderColor: '#E8E0D0' }}
              />
              <div className="flex justify-between">
                <span>予約種別</span>
                <span style={{ color: '#333333' }}>
                  {appointment.booking_type_name}
                </span>
              </div>
              <div
                className="border-t"
                style={{ borderColor: '#E8E0D0' }}
              />
              <div className="flex justify-between">
                <span>日時</span>
                <span style={{ color: '#333333' }}>
                  {formatDateTime(appointment.start_time)}
                </span>
              </div>
              <div
                className="border-t"
                style={{ borderColor: '#E8E0D0' }}
              />
              <div className="flex justify-between">
                <span>所要時間</span>
                <span style={{ color: '#333333' }}>
                  約{appointment.duration_minutes}分
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {(appointment.status === 'scheduled' || appointment.status === 'pending') && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => showToast('この機能は現在準備中です', 'info')}
              className="min-h-[48px] w-full rounded-lg border text-sm font-medium transition-colors"
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
              変更する
            </button>
            <button
              onClick={() => showToast('この機能は現在準備中です', 'info')}
              className="min-h-[48px] w-full rounded-lg border text-sm font-medium transition-colors"
              style={{
                borderColor: '#DC2626',
                color: '#DC2626',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#DC2626'
                e.currentTarget.style.color = '#FFFFFF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#DC2626'
              }}
            >
              キャンセルする
            </button>
          </div>
        )}
      </div>

      {/* Phone contact section */}
      {clinicPhone && (
        <div className="mx-auto mt-6 max-w-md text-center">
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: '#F8F5F0' }}
          >
            <p className="text-sm font-medium" style={{ color: '#333333' }}>
              お電話でのお問い合わせ
            </p>
            <a
              href={`tel:${clinicPhone.replace(/-/g, '')}`}
              className="mt-2 inline-flex items-center gap-2 text-lg font-medium"
              style={{ color: '#B8923A' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              {clinicPhone}
            </a>
          </div>
        </div>
      )}

      {/* Back to top */}
      <div className="mt-6 text-center">
        <Link
          href="/booking"
          className="text-sm underline"
          style={{ color: '#666666' }}
        >
          トップに戻る
        </Link>
      </div>
    </div>
  )
}
