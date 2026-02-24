'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import TodaySummary from '@/components/dashboard/TodaySummary'
import LabOrderAlert from '@/components/dashboard/LabOrderAlert'
import InventoryAlert from '@/components/dashboard/InventoryAlert'
import Skeleton from '@/components/ui/Skeleton'
import { useSettings } from '@/hooks/useSettings'

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

type DashboardData = {
  todayAppointments: Array<{
    id: string
    start_time: string
    unit_number: number
    status: string
    lab_order_id: string | null
    duration_minutes: number
    patient: { id: string; chart_number: string; name: string } | null
    staff: { id: string; name: string } | null
  }>
  todayLabOrders: Array<{
    id: string
    status: string
    item_type: string | null
    tooth_info: string | null
    due_date: string | null
    set_date: string | null
    lab: { id: string; name: string } | null
  }>
  tomorrowLabOrderCount: number
  overdueLabOrders: Array<{
    id: string
    patient_id: string
    status: string
    item_type: string | null
    tooth_info: string | null
    due_date: string | null
    lab: { id: string; name: string } | null
  }>
  inventoryAlertCount: number
  recentWebBookings: Array<{
    id: string
    start_time: string
    duration_minutes: number
    status: string
    booking_source: string
    created_at: string
    patient: { id: string; name: string } | null
  }>
}

export default function DashboardPage() {
  const today = formatDateLocal(new Date())
  const { visibleUnits } = useSettings()

  const { data, isLoading, mutate } = useSWR<DashboardData>(
    `/api/dashboard?date=${today}`,
    fetcher,
    { revalidateOnFocus: true }
  )

  const handleRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  // サマリー集計
  const appointments = data?.todayAppointments || []
  const totalCount = appointments.length
  const checkedInCount = appointments.filter(a => a.status === 'checked_in').length
  const completedCount = appointments.filter(a => a.status === 'completed').length
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length
  const noShowCount = appointments.filter(a => a.status === 'no_show').length
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length

  // 現在の空きユニット計算
  const busyUnits = new Set(
    appointments
      .filter(a => a.status === 'checked_in')
      .map(a => a.unit_number)
  )
  const availableUnits = visibleUnits.filter(u => !busyUnits.has(u)).length

  // 次の予約
  const now = new Date()
  const nextAppointment = appointments.find(a => {
    if (a.status !== 'scheduled') return false
    return new Date(a.start_time) >= now
  })

  // 本日のセット予定
  const labOrderMap = new Map(
    (data?.todayLabOrders || []).map(lo => [lo.id, lo])
  )
  const todayLabSets = appointments
    .filter(a => a.lab_order_id && labOrderMap.has(a.lab_order_id))
    .map(a => {
      const lo = labOrderMap.get(a.lab_order_id!)!
      return {
        start_time: a.start_time,
        unit_number: a.unit_number,
        patient_name: a.patient?.name || '',
        item_type: lo.item_type,
        tooth_info: lo.tooth_info,
        lab_name: lo.lab?.name || null,
        lab_status: lo.status,
      }
    })

  // 納品遅延
  const overdueItems = (data?.overdueLabOrders || []).map(lo => ({
    patient_id: lo.patient_id,
    item_type: lo.item_type,
    tooth_info: lo.tooth_info,
    lab_name: lo.lab?.name || null,
    status: lo.status,
    due_date: lo.due_date,
  }))

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? '更新中...' : '更新'}
          </button>
        </div>

        {isLoading && !data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <Skeleton className="mb-3 h-6 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <Skeleton className="mb-3 h-6 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <Skeleton className="mb-3 h-6 w-32" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ) : (
          <>
            {/* Web予約通知 */}
            {(data?.recentWebBookings?.length ?? 0) > 0 && (
              <WebBookingNotifications bookings={data!.recentWebBookings} />
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <TodaySummary
                totalCount={totalCount}
                scheduledCount={scheduledCount}
                checkedInCount={checkedInCount}
                completedCount={completedCount}
                cancelledCount={cancelledCount}
                noShowCount={noShowCount}
                availableUnits={availableUnits}
                visibleUnits={visibleUnits.length}
                nextAppointment={nextAppointment ? {
                  patient_name: nextAppointment.patient?.name || '',
                  start_time: nextAppointment.start_time,
                  unit_number: nextAppointment.unit_number,
                } : null}
              />
              <LabOrderAlert
                todayLabSets={todayLabSets}
                tomorrowLabSetCount={data?.tomorrowLabOrderCount || 0}
                overdueItems={overdueItems}
              />
              <InventoryAlert
                alertCount={data?.inventoryAlertCount || 0}
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

// Web予約通知セクション
function WebBookingNotifications({
  bookings,
}: {
  bookings: DashboardData['recentWebBookings']
}) {
  const formatTime = (startTime: string) => {
    const d = new Date(startTime)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatDate = (startTime: string) => {
    const d = new Date(startTime)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
    return `${m}/${day}(${dow})`
  }

  const formatCreatedAt = (createdAt: string) => {
    const d = new Date(createdAt)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const pendingCount = bookings.filter(b => b.status === 'pending').length

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
        <h3 className="text-sm font-bold text-blue-900">
          Web予約通知
        </h3>
        {pendingCount > 0 && (
          <>
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {pendingCount}件 承認待ち
            </span>
            <Link
              href="/appointments/pending"
              className="ml-auto rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
            >
              確認する
            </Link>
          </>
        )}
        <span className="text-xs text-blue-600">（直近24時間）</span>
      </div>
      <div className="space-y-2">
        {bookings.map((booking) => {
          const patientName = booking.patient && !Array.isArray(booking.patient)
            ? (booking.patient as { name: string }).name
            : '不明'
          const isPending = booking.status === 'pending'

          return (
            <div
              key={booking.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                isPending
                  ? 'border border-amber-200 bg-amber-50'
                  : 'bg-white'
              }`}
            >
              <span className="shrink-0 text-xs text-gray-400">
                {formatCreatedAt(booking.created_at)}
              </span>
              <span className="flex-1 text-gray-800">
                {isPending ? (
                  <>
                    Web予約リクエスト: {patientName}{' '}
                    {formatDate(booking.start_time)} {formatTime(booking.start_time)}
                  </>
                ) : (
                  <>
                    Web予約が入りました: {patientName}{' '}
                    {formatDate(booking.start_time)} {formatTime(booking.start_time)}
                  </>
                )}
              </span>
              {isPending ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  承認待ち
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  確定
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
