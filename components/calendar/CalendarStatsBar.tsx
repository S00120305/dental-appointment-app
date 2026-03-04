'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { AppointmentWithRelations, AppointmentStatus } from '@/lib/supabase/types'

const STATUS_STATS: { key: AppointmentStatus; label: string; bgClass: string }[] = [
  { key: 'scheduled', label: '未', bgClass: 'bg-gray-200 text-gray-700' },
  { key: 'checked_in', label: '受', bgClass: 'bg-blue-100 text-blue-700' },
  { key: 'completed', label: '完', bgClass: 'bg-green-100 text-green-700' },
  { key: 'cancelled', label: 'キ', bgClass: 'bg-red-100 text-red-600' },
  { key: 'no_show', label: '無', bgClass: 'bg-amber-100 text-amber-700' },
]

type Props = {
  appointments: AppointmentWithRelations[]
  selectedDate: string
  totalUnits: number
  pendingCount: number
}

export default function CalendarStatsBar({ appointments, selectedDate, totalUnits, pendingCount }: Props) {
  const stats = useMemo(() => {
    const dayAppts = appointments.filter(a => a.start_time.slice(0, 10) === selectedDate)
    const total = dayAppts.length
    const counts: Record<string, number> = {}
    for (const a of dayAppts) {
      counts[a.status] = (counts[a.status] || 0) + 1
    }
    const usedUnits = new Set(dayAppts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').map(a => a.unit_number))
    const freeUnits = totalUnits - usedUnits.size
    return { total, counts, freeUnits }
  }, [appointments, selectedDate, totalUnits])

  return (
    <div className="flex items-center gap-1 overflow-hidden text-[10px]">
      <span className="shrink-0 rounded bg-gray-100 px-1 font-bold text-gray-800">
        全{stats.total}
      </span>
      {STATUS_STATS.map(s => {
        const count = stats.counts[s.key] || 0
        if (count === 0) return null
        return (
          <span key={s.key} className={`shrink-0 rounded px-1 font-medium ${s.bgClass}`}>
            {s.label}{count}
          </span>
        )
      })}
      <span className="shrink-0 text-gray-500">
        空{stats.freeUnits}/{totalUnits}
      </span>
      {pendingCount > 0 && (
        <Link
          href="/appointments/pending"
          className="shrink-0 rounded bg-amber-100 px-1 font-medium text-amber-700 hover:bg-amber-200"
        >
          承認{pendingCount}
        </Link>
      )}
    </div>
  )
}
