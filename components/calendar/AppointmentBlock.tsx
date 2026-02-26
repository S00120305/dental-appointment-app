'use client'

import { memo } from 'react'
import type { EventContentArg } from '@fullcalendar/core'
import { STATUS_BG, STATUS_TEXT, STATUS_ICON, STATUS_ICON_COLOR, STATUS_BORDER_COLOR } from '@/lib/constants/appointment'
import { getPatientTagIconString } from '@/lib/constants/patient-tags'
import LabOrderBadge from './LabOrderBadge'
import type { AppointmentStatus } from '@/lib/supabase/types'

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

// 背景色の明度を計算してテキスト色を自動判定
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  if (hex.length < 6) return '#1f2937'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // W3C relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2937' : '#ffffff'
}

export function getEventStyle(
  status: string,
  staffColor: string,
  bookingTypeColor?: string | null
): React.CSSProperties {
  const borderColor = bookingTypeColor || STATUS_BORDER_COLOR[status] || STATUS_BORDER_COLOR['scheduled']
  const isCancelledOrNoShow = status === 'cancelled' || status === 'no_show'

  // スタッフ色がある場合は薄い背景色として使用、なければステータスの背景色
  const bg = staffColor
    ? staffColor + '20' // hex alpha ~12% opacity
    : (STATUS_BG[status] || STATUS_BG['scheduled'])

  // テキスト色: スタッフ色がある場合はコントラスト自動判定、なければステータス色
  const textColor = staffColor
    ? getContrastTextColor(staffColor)
    : (STATUS_TEXT[status] || STATUS_TEXT['scheduled'])

  return {
    backgroundColor: bg,
    color: textColor,
    borderLeft: `4px solid ${borderColor}`,
    height: '100%',
    padding: '2px 6px',
    overflow: 'hidden',
    lineHeight: '1.3',
    opacity: isCancelledOrNoShow ? 0.5 : 1,
  }
}

type AppointmentBlockProps = {
  eventInfo: EventContentArg
  onStatusClick?: (appointmentId: string) => void
}

const AppointmentBlock = memo(function AppointmentBlock({ eventInfo, onStatusClick }: AppointmentBlockProps) {
  const { extendedProps } = eventInfo.event
  const patientName = extendedProps.patient_name || ''
  const appointmentType = extendedProps.appointment_type || ''
  const staffName = extendedProps.staff_name || ''
  const status = (extendedProps.status || 'scheduled') as AppointmentStatus
  const labOrderStatus = extendedProps.lab_order_status as string | undefined
  const isInfectionAlert = extendedProps.is_infection_alert as boolean | undefined
  const hasSlideFrom = extendedProps.has_slide_from as boolean | undefined
  const hasSlideTo = extendedProps.has_slide_to as boolean | undefined

  const tagIcons = getPatientTagIconString({
    is_vip: extendedProps.is_vip as boolean | undefined,
    caution_level: extendedProps.caution_level as number | undefined,
    is_infection_alert: isInfectionAlert,
  })
  const appointmentTagIcons = (extendedProps.appointment_tag_icons as string) || ''

  const staffColor = (extendedProps.staff_color as string) || ''
  const bookingTypeColor = extendedProps.booking_type_color as string | null | undefined
  const style = getEventStyle(status, staffColor, bookingTypeColor)

  const statusIcon = STATUS_ICON[status] || '\u25CB'
  const statusIconColor = STATUS_ICON_COLOR[status] || '#9ca3af'
  const canAdvance = status === 'scheduled' || status === 'checked_in'

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (canAdvance && onStatusClick) {
      onStatusClick(eventInfo.event.id)
    }
  }

  return (
    <div style={style} className="rounded-md">
      <div className="truncate text-xs font-bold leading-tight">
        <span
          role={canAdvance ? 'button' : undefined}
          onClick={handleStatusClick}
          className={`mr-0.5 ${canAdvance ? 'cursor-pointer hover:opacity-70' : ''}`}
          style={{ color: statusIconColor }}
          title={canAdvance ? 'タップでステータス変更' : undefined}
        >
          {statusIcon}
        </span>
        {labOrderStatus && <span className="mr-0.5">{'\uD83E\uDDB7'}</span>}
        {hasSlideFrom && <span className="mr-0.5 text-blue-500" title="スライド先">{'\u21E8'}</span>}
        {status === 'cancelled' || status === 'no_show' ? (
          <span className="line-through">{patientName}</span>
        ) : (
          patientName
        )}
        {hasSlideTo && <span className="ml-0.5 text-blue-500" title="スライド元">{'\u21E8'}</span>}
        {tagIcons && (
          <>
            {' '}
            {isInfectionAlert ? (
              <span className="text-[10px]">
                {tagIcons.replace('\u266A', '')}
                <span className="rounded bg-purple-200 px-0.5 text-purple-700">{'\u266A'}</span>
              </span>
            ) : (
              <span className="text-[10px]">{tagIcons}</span>
            )}
          </>
        )}
        {appointmentTagIcons && (
          <span className="text-[10px] ml-0.5">{appointmentTagIcons}</span>
        )}
      </div>
      <div className="truncate text-[10px] leading-tight opacity-80">
        {appointmentType}
        {staffName && ` / ${staffName}`}
      </div>
      {labOrderStatus && (
        <div className="truncate">
          <LabOrderBadge labOrderStatus={labOrderStatus} size="sm" />
        </div>
      )}
    </div>
  )
})

export default AppointmentBlock
