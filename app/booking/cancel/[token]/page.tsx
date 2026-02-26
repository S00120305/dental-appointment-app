'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

type AppointmentData = {
  start_time: string
  duration_minutes: number
  status: string
  patient_name: string
  booking_type_name: string
}

export default function BookingCancelPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicPhone, setClinicPhone] = useState('')
  const [deadlinePassed, setDeadlinePassed] = useState(false)

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

        // ステータスチェック
        if (appt.status === 'cancelled') {
          setError('この予約は既にキャンセル済みです')
          return
        }
        if (appt.status !== 'scheduled' && appt.status !== 'pending') {
          setError('この予約はキャンセルできません')
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

  const handleCancel = async () => {
    setCancelling(true)
    setError(null)

    try {
      const res = await fetch(`/api/booking/cancel/${token}`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        setCancelled(true)
      } else {
        setError(data.error || 'キャンセルに失敗しました')
        if (data.clinic_phone) setClinicPhone(data.clinic_phone)
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setCancelling(false)
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

  // Cancelled successfully
  if (cancelled) {
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
          予約をキャンセルしました
        </h2>

        <div
          className="mx-auto mt-6 max-w-sm rounded-lg p-4"
          style={{ backgroundColor: '#F8F5F0' }}
        >
          <p className="text-sm" style={{ color: '#999999' }}>キャンセル済み</p>
          <p className="mt-1 text-sm font-medium" style={{ color: '#333333' }}>
            {formatDateTime(appointment.start_time)}〜
          </p>
          <p className="mt-1 text-sm" style={{ color: '#666666' }}>
            {appointment.booking_type_name}（{appointment.duration_minutes}分）
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-sm" style={{ color: '#666666' }}>
            再度のご予約はこちら:
          </p>
          <Link
            href="/booking/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg px-8 text-sm font-medium text-white"
            style={{ backgroundColor: '#B8923A' }}
          >
            新規予約へ
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
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-medium" style={{ color: '#333333' }}>
          予約のキャンセル
        </h1>
      </div>

      {/* Appointment details */}
      <div className="mx-auto mt-8 max-w-md">
        <p className="mb-3 text-center text-sm" style={{ color: '#666666' }}>
          以下の予約をキャンセルしますか？
        </p>

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

        {deadlinePassed ? (
          <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>
              変更・キャンセルの受付期限を過ぎています。
            </p>
            {clinicPhone && (
              <p className="mt-2 text-sm" style={{ color: '#666666' }}>
                恐れ入りますが、お電話にてご連絡ください。
                <br />
                <a
                  href={`tel:${clinicPhone.replace(/-/g, '')}`}
                  className="font-medium"
                  style={{ color: '#B8923A' }}
                >
                  {clinicPhone}
                </a>
              </p>
            )}
          </div>
        ) : (
          <>
            <div
              className="mt-4 rounded-lg p-3"
              style={{ backgroundColor: '#FEF2F2' }}
            >
              <p className="text-sm" style={{ color: '#DC2626' }}>
                キャンセルは取り消せません。再度ご予約が必要な場合は新規予約からお願いいたします。
              </p>
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-600">{error}</p>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="min-h-[48px] w-full rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#DC2626' }}
              >
                {cancelling ? 'キャンセル中...' : 'キャンセルする'}
              </button>
              <Link
                href={`/booking/confirm/${token}`}
                className="block min-h-[48px] w-full rounded-lg border py-3 text-center text-sm font-medium transition-colors"
                style={{ borderColor: '#E8E0D0', color: '#666666' }}
              >
                やっぱりやめる
              </Link>
            </div>
          </>
        )}
      </div>

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
