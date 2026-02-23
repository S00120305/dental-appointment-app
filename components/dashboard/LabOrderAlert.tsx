'use client'

import { getLabStatusConfig } from '@/components/calendar/LabOrderBadge'

type LabSetItem = {
  start_time: string
  unit_number: number
  patient_name: string
  item_type: string | null
  tooth_info: string | null
  lab_name: string | null
  lab_status: string
}

type OverdueItem = {
  patient_id: string // カルテNo
  item_type: string | null
  tooth_info: string | null
  lab_name: string | null
  status: string
  due_date: string | null
}

type LabOrderAlertProps = {
  todayLabSets: LabSetItem[]
  tomorrowLabSetCount: number
  overdueItems: OverdueItem[]
}

export default function LabOrderAlert({
  todayLabSets,
  tomorrowLabSetCount,
  overdueItems,
}: LabOrderAlertProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">技工物アラート</h2>
        {tomorrowLabSetCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
            明日: {tomorrowLabSetCount}件
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {/* 納品遅延 */}
        {overdueItems.length > 0 && (
          <div className="bg-red-50 px-4 py-3">
            <div className="text-sm font-bold text-red-700 mb-2">
              {'\u274C'} 納品遅延 ({overdueItems.length}件)
            </div>
            {overdueItems.map((item, i) => (
              <div key={i} className="text-sm text-red-700 ml-2 mb-1">
                <span className="font-medium">{item.item_type || '技工物'}</span>
                {item.tooth_info && <span className="text-red-500"> ({item.tooth_info})</span>}
                {item.lab_name && <span className="text-red-400"> — {item.lab_name}</span>}
                <span className="text-red-400 text-xs ml-1">
                  納期: {item.due_date} / {item.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 本日のセット予定 */}
        {todayLabSets.length > 0 ? (
          <div className="px-4 py-3">
            <div className="text-sm font-bold text-gray-700 mb-3">
              {'\uD83D\uDCC5'} 本日のセット予定
            </div>
            <div className="space-y-3">
              {todayLabSets.map((item, i) => {
                const config = getLabStatusConfig(item.lab_status)
                return (
                  <div key={i} className="rounded-md border border-gray-100 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-gray-900">
                        {new Date(item.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-medium text-gray-700">{item.patient_name}</span>
                      <span className="text-xs text-gray-400">(診察室{item.unit_number})</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.item_type || '技工物'}
                      {item.tooth_info && ` (${item.tooth_info})`}
                      {item.lab_name && ` — ${item.lab_name}`}
                    </div>
                    <div className="mt-1 text-xs font-medium" style={{ color: config.color }}>
                      {config.icon} {config.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">本日のセット予定はありません</p>
          </div>
        )}
      </div>
    </div>
  )
}
