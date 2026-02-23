'use client'

import type { EventContentArg } from '@fullcalendar/core'
import { STATUS_BG, STATUS_TEXT } from '@/lib/constants/appointment'

// デフォルトのスタッフカラーパレット
const DEFAULT_STAFF_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

export function getStaffColor(
  staffId: string,
  staffColors: Record<string, string>,
  staffIndex: number
): string {
  return staffColors[staffId] || DEFAULT_STAFF_COLORS[staffIndex % DEFAULT_STAFF_COLORS.length]
}

export function getEventStyle(
  status: string,
  staffColor: string
): React.CSSProperties {
  const bg = STATUS_BG[status] || STATUS_BG['予約済み']
  const textColor = STATUS_TEXT[status] || STATUS_TEXT['予約済み']

  return {
    backgroundColor: bg,
    color: textColor,
    borderLeft: `4px solid ${staffColor}`,
    height: '100%',
    padding: '2px 6px',
    overflow: 'hidden',
    lineHeight: '1.3',
  }
}

export default function AppointmentBlock({ eventInfo }: { eventInfo: EventContentArg }) {
  const { extendedProps } = eventInfo.event
  const patientName = extendedProps.patient_name || ''
  const appointmentType = extendedProps.appointment_type || ''
  const staffName = extendedProps.staff_name || ''
  const status = extendedProps.status || '予約済み'
  const staffColor = extendedProps.staff_color || '#3b82f6'

  const style = getEventStyle(status, staffColor)

  return (
    <div style={style} className="rounded-md">
      <div className="truncate text-xs font-bold leading-tight">{patientName}</div>
      <div className="truncate text-[10px] leading-tight opacity-80">
        {appointmentType}
        {staffName && ` / ${staffName}`}
      </div>
    </div>
  )
}
