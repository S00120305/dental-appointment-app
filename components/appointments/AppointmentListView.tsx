'use client'

import { memo, useCallback, useMemo } from 'react'
import StatusBadge from '@/components/calendar/StatusBadge'
import LabOrderBadge from '@/components/calendar/LabOrderBadge'
import { getPatientTagIcons } from '@/lib/constants/patient-tags'
import { getNextStatus, STATUS_LABELS, STATUS_TEXT } from '@/lib/constants/appointment'
import type { AppointmentStatus, AppointmentWithRelations, BlockedSlot } from '@/lib/supabase/types'

type Props = {
  appointments: AppointmentWithRelations[]
  blockedSlots: BlockedSlot[]
  loading: boolean
  onStatusChange: (id: string, newStatus: AppointmentStatus) => Promise<void>
  onAppointmentClick: (appt: AppointmentWithRelations) => void
}

type ListItem =
  | { type: 'appointment'; data: AppointmentWithRelations; time: Date }
  | { type: 'block'; data: BlockedSlot; time: Date }

const AppointmentListView = memo(function AppointmentListView({
  appointments,
  blockedSlots,
  loading,
  onStatusChange,
  onAppointmentClick,
}: Props) {
  const handleQuickStatusAdvance = useCallback((appt: AppointmentWithRelations) => {
    const next = getNextStatus(appt.status)
    if (next) onStatusChange(appt.id, next)
  }, [onStatusChange])

  const listItems: ListItem[] = useMemo(() => [
    ...appointments.map(a => ({
      type: 'appointment' as const,
      data: a,
      time: new Date(a.start_time),
    })),
    ...blockedSlots.map(b => ({
      type: 'block' as const,
      data: b,
      time: new Date(b.start_time),
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime()), [appointments, blockedSlots])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (listItems.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-400">予約はありません</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
            <th className="px-3 py-2 w-16">時間</th>
            <th className="px-3 py-2 w-10">診</th>
            <th className="px-3 py-2">患者名</th>
            <th className="px-3 py-2 w-24">種別</th>
            <th className="px-3 py-2 w-16">担当</th>
            <th className="px-3 py-2 w-16">技工物</th>
            <th className="px-3 py-2 w-32 text-center">ステータス</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {listItems.map((item) => {
            if (item.type === 'block') {
              const block = item.data
              const bTime = new Date(block.start_time)
              const timeStr = bTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              return (
                <tr key={`block-${block.id}`} className="bg-gray-50 text-gray-400">
                  <td className="px-3 py-2 text-xs">{timeStr}</td>
                  <td className="px-3 py-2 text-xs">{block.unit_number === 0 ? '全' : `診${block.unit_number}`}</td>
                  <td colSpan={4} className="px-3 py-2 text-xs">
                    {'\u{1F6AB}'} {block.reason || 'ブロック'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[10px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-500">ブロック</span>
                  </td>
                </tr>
              )
            }

            const appt = item.data
            const aTime = new Date(appt.start_time)
            const timeStr = aTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            const tags = appt.patient ? getPatientTagIcons(appt.patient) : []
            const nextStatus = getNextStatus(appt.status)
            const isCancelledOrNoShow = appt.status === 'cancelled' || appt.status === 'no_show'

            return (
              <tr
                key={appt.id}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                  isCancelledOrNoShow ? 'opacity-50' : ''
                }`}
                onClick={() => onAppointmentClick(appt)}
              >
                <td className="px-3 py-2 text-sm text-gray-700">{timeStr}</td>
                <td className="px-3 py-2 text-sm text-gray-500">診{appt.unit_number}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-900">{appt.patient?.name || '—'}</span>
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        title={tag.label}
                        style={{ color: tag.color }}
                        className={`text-xs ${tag.label === '\u611F\u67D3\u6CE8\u610F' ? 'rounded bg-purple-100 px-0.5' : ''}`}
                      >
                        {tag.icon}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[100px]">
                  {appt.appointment_type}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 truncate">
                  {appt.staff?.name || '—'}
                </td>
                <td className="px-3 py-2">
                  {appt.lab_order && (
                    <LabOrderBadge labOrderStatus={appt.lab_order.status} size="sm" />
                  )}
                </td>
                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  {isCancelledOrNoShow ? (
                    <StatusBadge status={appt.status} size="sm" />
                  ) : nextStatus ? (
                    <button
                      onClick={() => handleQuickStatusAdvance(appt)}
                      className="min-h-[36px] rounded-full px-3 py-1 text-xs font-medium text-white transition-colors"
                      style={{
                        backgroundColor: STATUS_TEXT[appt.status] || '#374151',
                      }}
                    >
                      {STATUS_LABELS[appt.status as AppointmentStatus]}
                      {' '}→
                    </button>
                  ) : (
                    <StatusBadge status={appt.status} size="sm" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

export default AppointmentListView
