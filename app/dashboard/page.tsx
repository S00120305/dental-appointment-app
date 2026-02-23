'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import TodaySummary from '@/components/dashboard/TodaySummary'
import LabOrderAlert from '@/components/dashboard/LabOrderAlert'
import InventoryAlert from '@/components/dashboard/InventoryAlert'

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unitCount, setUnitCount] = useState(5)

  const today = formatDateLocal(new Date())

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, settingsRes] = await Promise.all([
        fetch(`/api/dashboard?date=${today}`),
        fetch('/api/settings'),
      ])

      const dashData = await dashRes.json()
      const settingsData = await settingsRes.json()

      if (dashRes.ok) setData(dashData)
      if (settingsRes.ok && settingsData.settings?.unit_count) {
        setUnitCount(parseInt(settingsData.settings.unit_count))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // visibilitychange でリフレッシュ
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchDashboard()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchDashboard])

  // サマリー集計
  const appointments = data?.todayAppointments || []
  const totalCount = appointments.length
  const arrivedCount = appointments.filter(a => a.status === '来院済み').length
  const inProgressCount = appointments.filter(a => a.status === '診療中').length
  const completedCount = appointments.filter(a => a.status === '帰宅済み').length
  const cancelledCount = appointments.filter(a => a.status === 'キャンセル').length
  const notArrivedCount = appointments.filter(a => a.status === '予約済み').length

  // 現在の空きユニット計算（診療中のユニット数を除外）
  const busyUnits = new Set(
    appointments
      .filter(a => a.status === '診療中')
      .map(a => a.unit_number)
  )
  const availableUnits = unitCount - busyUnits.size

  // 次の予約（現在時刻以降で未来院の最初の予約）
  const now = new Date()
  const nextAppointment = appointments.find(a => {
    if (a.status !== '予約済み') return false
    return new Date(a.start_time) >= now
  })

  // 本日のセット予定（技工物紐付き予約をlab_ordersとマッチ）
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
            onClick={fetchDashboard}
            disabled={loading}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>

        {loading && !data ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-400">読み込み中...</div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 本日サマリー */}
            <TodaySummary
              totalCount={totalCount}
              arrivedCount={arrivedCount}
              notArrivedCount={notArrivedCount}
              cancelledCount={cancelledCount}
              inProgressCount={inProgressCount}
              completedCount={completedCount}
              availableUnits={availableUnits}
              unitCount={unitCount}
              nextAppointment={nextAppointment ? {
                patient_name: nextAppointment.patient?.name || '',
                start_time: nextAppointment.start_time,
                unit_number: nextAppointment.unit_number,
              } : null}
            />

            {/* 技工物アラート */}
            <LabOrderAlert
              todayLabSets={todayLabSets}
              tomorrowLabSetCount={data?.tomorrowLabOrderCount || 0}
              overdueItems={overdueItems}
            />

            {/* 在庫アラート */}
            <InventoryAlert
              alertCount={data?.inventoryAlertCount || 0}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
