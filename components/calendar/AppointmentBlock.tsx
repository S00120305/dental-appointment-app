'use client'

import type { EventContentArg } from '@fullcalendar/core'

// ステータス別の背景色
const STATUS_BG: Record<string, string> = {
  '予約済み': '#e5e7eb',   // グレー
  '来院済み': '#dbeafe',   // 青
  '診療中': '#dcfce7',     // 緑
  '帰宅済み': '#f3f4f6',   // 薄グレー
  'キャンセル': '#fee2e2', // 赤
}

const STATUS_TEXT: Record<string, string> = {
  '予約済み': '#374151',
  '来院済み': '#1d4ed8',
  '診療中': '#15803d',
  '帰宅済み': '#9ca3af',
  'キャンセル': '#dc2626',
}

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
