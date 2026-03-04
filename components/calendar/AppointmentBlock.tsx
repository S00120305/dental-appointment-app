'use client'

import { memo } from 'react'
import type { EventContentArg } from '@fullcalendar/core'
import { STATUS_BG, STATUS_TEXT, STATUS_BORDER_COLOR, STATUS_SHORT_LABELS, STATUS_BADGE_BG } from '@/lib/constants/appointment'
import { getPatientTagIconString } from '@/lib/constants/patient-tags'
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

  return {
    backgroundColor: bg,
    color: '#1e293b',
    borderLeft: `4px solid ${borderColor}`,
    height: '100%',
    padding: '1px 3px 1px',
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

/** start_time + duration → "HH:MM-HH:MM" */
function formatTimeRange(startIso: string, durationMinutes: number): string {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const s = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
  const e = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  return `${s}-${e}`
}

type ParsedTag = { name: string; color: string | null; icon: string | null }

// 技工物ステータス色
const LAB_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  '納品済み': { bg: '#dcfce7', text: '#15803d' },
  'セット完了': { bg: '#f3f4f6', text: '#6b7280' },
  '製作中': { bg: '#fef3c7', text: '#b45309' },
  '未発注': { bg: '#fef2f2', text: '#dc2626' },
  'キャンセル': { bg: '#f3f4f6', text: '#9ca3af' },
}

type AppointmentBlockProps = {
  eventInfo: EventContentArg
  onStatusClick?: (appointmentId: string) => void
}

const AppointmentBlock = memo(function AppointmentBlock({ eventInfo, onStatusClick }: AppointmentBlockProps) {
  const { extendedProps } = eventInfo.event
  const patientName = extendedProps.patient_name || ''
  const chartNumber = extendedProps.patient_chart_number || ''
  const bookingTypeName = extendedProps.booking_type_name as string | null
  const bookingTypeColor = extendedProps.booking_type_color as string | null
  const appointmentType = extendedProps.appointment_type || ''
  const staffName = extendedProps.staff_name || ''
  const status = (extendedProps.status || 'scheduled') as AppointmentStatus
  const labOrderStatus = extendedProps.lab_order_status as string | undefined
  const isInfectionAlert = extendedProps.is_infection_alert as boolean | undefined
  const isSlide = extendedProps.is_slide as boolean | undefined
  const slidePartnerUnits = (extendedProps.slide_partner_units as number[]) || []
  const dateOfBirth = extendedProps.patient_date_of_birth as string | null
  const startTimeStr = extendedProps.start_time_str as string | null
  const durationMinutes = (extendedProps.duration_minutes as number) || 30
  const memo = extendedProps.memo as string | null

  // Parse appointment_tags JSON
  let parsedTags: ParsedTag[] = []
  try {
    const tagsStr = extendedProps.appointment_tags as string | null
    if (tagsStr) parsedTags = JSON.parse(tagsStr)
  } catch { /* ignore */ }

  const tagIcons = getPatientTagIconString({
    is_vip: extendedProps.is_vip as boolean | undefined,
    caution_level: extendedProps.caution_level as number | undefined,
    is_infection_alert: isInfectionAlert,
  })
  const appointmentTagIcons = (extendedProps.appointment_tag_icons as string) || ''

  const staffColor = (extendedProps.staff_color as string) || ''
  const style = getEventStyle(status, staffColor, bookingTypeColor)

  const canAdvance = status === 'scheduled' || status === 'checked_in' || status === 'pending'
  const statusLabel = STATUS_SHORT_LABELS[status] || '未'
  const badgeBg = STATUS_BADGE_BG[status] || '#9ca3af'

  const age = calcAge(dateOfBirth)
  const timeRange = startTimeStr ? formatTimeRange(startTimeStr, durationMinutes) : ''
  const displayType = bookingTypeName || appointmentType

  // 所要時間による行数制御: 10min=1行, 20min=2行, 30min=3行, 40min+=5行(全表示)
  const lines = durationMinutes <= 10 ? 1 : durationMinutes <= 20 ? 2 : durationMinutes <= 30 ? 3 : 5

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (canAdvance && onStatusClick) {
      onStatusClick(eventInfo.event.id)
    }
  }

  return (
    <div style={style} className="rounded-none">
      {/* Line 1: ステータスバッジ(大) + カルテNo + 患者名(太字) + 年齢 + タグ */}
      <div className="truncate font-bold leading-tight" style={{ fontSize: 'var(--fc-event-name-size)', color: '#1e293b' }}>
        <span
          role={canAdvance ? 'button' : undefined}
          onClick={handleStatusClick}
          className={`mr-0.5 inline-flex items-center justify-center rounded-none font-bold text-white ${canAdvance ? 'cursor-pointer hover:opacity-70' : ''}`}
          style={{
            backgroundColor: badgeBg,
            fontSize: '10px',
            padding: '0 3px',
            lineHeight: '1.4',
            verticalAlign: 'text-bottom',
            minWidth: '16px',
            minHeight: '16px',
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

      {/* Line 2: 時間帯（灰色テキスト） */}
      {lines >= 2 && timeRange && (
        <div className="truncate leading-tight" style={{ fontSize: 'var(--fc-event-detail-size)', color: '#64748b' }}>
          {timeRange}
        </div>
      )}

      {/* Line 3: 予約種別をカラーピルバッジ表示 */}
      {lines >= 3 && displayType && (
        <div className="truncate leading-tight" style={{ fontSize: 'var(--fc-event-detail-size)' }}>
          {bookingTypeColor ? (
            <span
              className="inline-block rounded-full px-1.5 text-white"
              style={{
                backgroundColor: bookingTypeColor,
                fontSize: 'var(--fc-event-tag-size)',
                lineHeight: '1.5',
              }}
            >
              {displayType}
            </span>
          ) : (
            <span className="opacity-80">{displayType}</span>
          )}
        </div>
      )}

      {/* Line 4: メモ（ある場合のみ、40min+で表示） */}
      {lines >= 5 && memo && (
        <div className="truncate leading-tight" style={{ fontSize: 'var(--fc-event-detail-size)', color: '#64748b' }}>
          {memo}
        </div>
      )}

      {/* Line 5: 担当+タグ+技工物をカラーバッジで表示（40min+で表示） */}
      {lines >= 5 && (
        <div className="flex flex-wrap items-center gap-0.5 leading-tight" style={{ fontSize: 'var(--fc-event-tag-size)' }}>
          {staffName && (
            <span
              className="inline-block rounded-full px-1.5 text-white"
              style={{
                backgroundColor: staffColor || '#6b7280',
                lineHeight: '1.5',
              }}
            >
              {staffName}
            </span>
          )}
          {parsedTags.map((tag, i) => (
            <span
              key={i}
              className="inline-block rounded-full px-1.5 text-white"
              style={{
                backgroundColor: tag.color || '#6b7280',
                lineHeight: '1.5',
              }}
            >
              {tag.icon || ''}{tag.name}
            </span>
          ))}
          {labOrderStatus && (() => {
            const lc = LAB_STATUS_COLORS[labOrderStatus] || LAB_STATUS_COLORS['製作中']
            return (
              <span
                className="inline-block rounded-full px-1.5"
                style={{
                  backgroundColor: lc.bg,
                  color: lc.text,
                  lineHeight: '1.5',
                }}
              >
                {labOrderStatus}
              </span>
            )
          })()}
        </div>
      )}
    </div>
  )
})

export default AppointmentBlock
