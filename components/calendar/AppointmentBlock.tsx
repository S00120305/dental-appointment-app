'use client'

import { memo } from 'react'
import type { EventContentArg } from '@fullcalendar/core'
import { STATUS_BG, STATUS_TEXT, STATUS_BORDER_COLOR, STATUS_SHORT_LABELS, STATUS_BADGE_BG } from '@/lib/constants/appointment'
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

export function getEventStyle(
  status: string,
  staffColor: string,
  bookingTypeColor?: string | null
): React.CSSProperties {
  const borderColor = bookingTypeColor || STATUS_BORDER_COLOR[status] || STATUS_BORDER_COLOR['scheduled']
  const isCancelledOrNoShow = status === 'cancelled' || status === 'no_show'

  const bg = staffColor
    ? staffColor + '40'
    : (STATUS_BG[status] || STATUS_BG['scheduled'])

  const textColor = staffColor
    ? '#1f2937'
    : (STATUS_TEXT[status] || STATUS_TEXT['scheduled'])

  return {
    backgroundColor: bg,
    color: textColor,
    borderLeft: `4px solid ${borderColor}`,
    height: '100%',
    padding: '2px 4px 1px',
    overflow: 'hidden',
    lineHeight: '1.3',
    opacity: isCancelledOrNoShow ? 0.5 : 1,
  }
}

/** date_of_birth → 年齢を計算 */
function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

/** start_time → "HH:MM" */
function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** start_time + duration → "HH:MM-HH:MM" */
function formatTimeRange(startIso: string, durationMinutes: number): string {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const s = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
  const e = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  return `${s}-${e}`
}

type AppointmentBlockProps = {
  eventInfo: EventContentArg
  onStatusClick?: (appointmentId: string) => void
}

const AppointmentBlock = memo(function AppointmentBlock({ eventInfo, onStatusClick }: AppointmentBlockProps) {
  const { extendedProps } = eventInfo.event
  const patientName = extendedProps.patient_name || ''
  const chartNumber = extendedProps.patient_chart_number || ''
  const appointmentType = extendedProps.appointment_type || ''
  const bookingTypeName = extendedProps.booking_type_name as string | null
  const staffName = extendedProps.staff_name || ''
  const status = (extendedProps.status || 'scheduled') as AppointmentStatus
  const labOrderStatus = extendedProps.lab_order_status as string | undefined
  const isInfectionAlert = extendedProps.is_infection_alert as boolean | undefined
  const isSlide = extendedProps.is_slide as boolean | undefined
  const slidePartnerUnits = (extendedProps.slide_partner_units as number[]) || []
  const dateOfBirth = extendedProps.patient_date_of_birth as string | null
  const startTimeStr = extendedProps.start_time_str as string | null
  const durationMinutes = (extendedProps.duration_minutes as number) || 30

  const tagIcons = getPatientTagIconString({
    is_vip: extendedProps.is_vip as boolean | undefined,
    caution_level: extendedProps.caution_level as number | undefined,
    is_infection_alert: isInfectionAlert,
  })
  const appointmentTagIcons = (extendedProps.appointment_tag_icons as string) || ''

  const staffColor = (extendedProps.staff_color as string) || ''
  const bookingTypeColor = extendedProps.booking_type_color as string | null | undefined
  const style = getEventStyle(status, staffColor, bookingTypeColor)

  const canAdvance = status === 'scheduled' || status === 'checked_in' || status === 'pending'
  const statusLabel = STATUS_SHORT_LABELS[status] || '未'
  const badgeBg = STATUS_BADGE_BG[status] || '#9ca3af'

  const age = calcAge(dateOfBirth)
  const timeRange = startTimeStr ? formatTimeRange(startTimeStr, durationMinutes) : ''
  const displayType = bookingTypeName || appointmentType

  // 所要時間による行数制御: 10min=1行, 20min=2行, 30min+=3行
  const lines = durationMinutes <= 10 ? 1 : durationMinutes <= 20 ? 2 : 3

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (canAdvance && onStatusClick) {
      onStatusClick(eventInfo.event.id)
    }
  }

  return (
    <div style={style} className="rounded-md">
      {/* Line 1: ステータスバッジ + カルテNo + 患者名 + 年齢 + タグ */}
      <div className="truncate font-bold leading-tight" style={{ fontSize: 'var(--fc-event-name-size)' }}>
        <span
          role={canAdvance ? 'button' : undefined}
          onClick={handleStatusClick}
          className={`mr-0.5 inline-flex items-center justify-center rounded text-white ${canAdvance ? 'cursor-pointer hover:opacity-70' : ''}`}
          style={{
            backgroundColor: badgeBg,
            fontSize: '9px',
            padding: '0 3px',
            lineHeight: '1.4',
            verticalAlign: 'text-bottom',
            minWidth: '14px',
          }}
          title={canAdvance ? 'タップでステータス変更' : undefined}
        >
          {statusLabel}
        </span>
        {chartNumber && (
          <span className="mr-0.5 opacity-60" style={{ fontSize: 'var(--fc-event-tag-size)' }}>
            {chartNumber}
          </span>
        )}
        {isSlide && (
          <span
            className="mr-0.5 inline-flex items-center rounded bg-blue-100 text-blue-600"
            style={{ fontSize: 'var(--fc-event-tag-size)', padding: '0 2px' }}
            title={`スライド: 診${slidePartnerUnits.join(',')}`}
          >
            {'\u21C4'}{slidePartnerUnits.length === 1 ? slidePartnerUnits[0] : ''}
          </span>
        )}
        {status === 'cancelled' || status === 'no_show' ? (
          <span className="line-through">{patientName}</span>
        ) : (
          patientName
        )}
        {age !== null && (
          <span className="ml-0.5 opacity-60" style={{ fontSize: 'var(--fc-event-tag-size)' }}>
            ({age})
          </span>
        )}
        {tagIcons && (
          <>
            {' '}
            {isInfectionAlert ? (
              <span style={{ fontSize: 'var(--fc-event-tag-size)' }}>
                {tagIcons.replace('\u266A', '')}
                <span className="rounded bg-purple-200 px-0.5 text-purple-700">{'\u266A'}</span>
              </span>
            ) : (
              <span style={{ fontSize: 'var(--fc-event-tag-size)' }}>{tagIcons}</span>
            )}
          </>
        )}
        {appointmentTagIcons && (
          <span style={{ fontSize: 'var(--fc-event-tag-size)' }} className="ml-0.5">{appointmentTagIcons}</span>
        )}
      </div>

      {/* Line 2: 時間帯 + 予約種別 (20min以上で表示) */}
      {lines >= 2 && (
        <div className="truncate leading-tight opacity-90" style={{ fontSize: 'var(--fc-event-detail-size)' }}>
          {timeRange && <span className="mr-1">{timeRange}</span>}
          {displayType}
        </div>
      )}

      {/* Line 3: 担当 + 技工物 + タグ (30min以上で表示) */}
      {lines >= 3 && (
        <div className="truncate leading-tight" style={{ fontSize: 'var(--fc-event-detail-size)' }}>
          {staffName && <span className="mr-1 opacity-80">{staffName}</span>}
          {labOrderStatus && <LabOrderBadge labOrderStatus={labOrderStatus} size="sm" />}
        </div>
      )}
    </div>
  )
})

export default AppointmentBlock
