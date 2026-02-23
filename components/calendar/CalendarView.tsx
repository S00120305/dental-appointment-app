'use client'

import { useRef, useEffect, useMemo, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  EventClickArg,
  DateSelectArg,
  EventDropArg,
  DatesSetArg,
  EventContentArg,
} from '@fullcalendar/core'
import AppointmentBlock, { getStaffColor, getEventStyle } from './AppointmentBlock'
import type { AppointmentWithRelations } from '@/lib/supabase/types'

export type BusinessHours = {
  start: string
  end: string
  lunch_start: string
  lunch_end: string
}

export type CalendarResource = {
  id: string
  title: string
}

interface CalendarViewProps {
  appointments: AppointmentWithRelations[]
  resources: CalendarResource[]
  businessHours: BusinessHours
  staffColors: Record<string, string>
  staffList: { id: string; name: string }[]
  initialDate: string
  viewType: 'resourceTimeGridDay' | 'resourceTimeGridWeek'
  onDateSelect: (start: Date, end: Date, resourceId: string) => void
  onEventClick: (appointmentId: string) => void
  onEventDrop: (appointmentId: string, newStart: Date, newResourceId: string, revert: () => void) => void
  onDatesSet: (start: Date, end: Date) => void
}

export default function CalendarView({
  appointments,
  resources,
  businessHours,
  staffColors,
  staffList,
  initialDate,
  viewType,
  onDateSelect,
  onEventClick,
  onEventDrop,
  onDatesSet,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)

  // Build staff index map for default color assignment
  const staffIndexMap = useMemo(() => {
    const map: Record<string, number> = {}
    staffList.forEach((s, i) => { map[s.id] = i })
    return map
  }, [staffList])

  // Convert appointments to FullCalendar events
  const events = useMemo(() => {
    const appointmentEvents = appointments.map((appt) => {
      const startDate = new Date(appt.start_time)
      const endDate = new Date(startDate.getTime() + appt.duration_minutes * 60 * 1000)
      const staffColor = getStaffColor(
        appt.staff_id,
        staffColors,
        staffIndexMap[appt.staff_id] ?? 0
      )

      return {
        id: appt.id,
        resourceId: String(appt.unit_number),
        start: startDate,
        end: endDate,
        title: appt.patient?.name || '',
        extendedProps: {
          patient_name: appt.patient?.name || '',
          patient_chart_number: appt.patient?.chart_number || '',
          appointment_type: appt.appointment_type,
          staff_name: appt.staff?.name || '',
          staff_id: appt.staff_id,
          status: appt.status,
          staff_color: staffColor,
        },
      }
    })

    // 昼休み背景イベント
    const lunchEvents = resources.map((r) => ({
      id: `lunch-${r.id}`,
      resourceId: r.id,
      start: `${initialDate}T${businessHours.lunch_start}:00`,
      end: `${initialDate}T${businessHours.lunch_end}:00`,
      display: 'background' as const,
      backgroundColor: '#f3f4f6',
      classNames: ['lunch-break'],
    }))

    return [...appointmentEvents, ...lunchEvents]
  }, [appointments, resources, businessHours, initialDate, staffColors, staffIndexMap])

  // Sync view type
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api && api.view.type !== viewType) {
      api.changeView(viewType)
    }
  }, [viewType])

  // Sync date
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api && initialDate) {
      const currentDate = api.getDate()
      const target = new Date(initialDate + 'T00:00:00')
      if (currentDate.toDateString() !== target.toDateString()) {
        api.gotoDate(target)
      }
    }
  }, [initialDate])

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    onDateSelect(info.start, info.end, info.resource?.id || '1')
  }, [onDateSelect])

  const handleEventClick = useCallback((info: EventClickArg) => {
    if (info.event.id.startsWith('lunch-')) return
    onEventClick(info.event.id)
  }, [onEventClick])

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const newResourceId = info.newResource?.id || info.event.getResources()[0]?.id || '1'
    onEventDrop(info.event.id, info.event.start!, newResourceId, info.revert)
  }, [onEventDrop])

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    onDatesSet(info.start, info.end)
  }, [onDatesSet])

  const renderEventContent = useCallback((eventInfo: EventContentArg) => {
    if (eventInfo.event.display === 'background') return null
    return <AppointmentBlock eventInfo={eventInfo} />
  }, [])

  return (
    <div className="calendar-container">
      <FullCalendar
        ref={calendarRef}
        plugins={[resourceTimeGridPlugin, interactionPlugin]}
        initialView={viewType}
        initialDate={initialDate}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        // Resources（横軸：ユニット）
        resources={resources}
        // 時間設定（縦軸：時間）
        slotMinTime={businessHours.start + ':00'}
        slotMaxTime={businessHours.end + ':00'}
        slotDuration="00:10:00"
        slotLabelInterval="00:30:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }}
        // 表示設定
        headerToolbar={false}
        height="auto"
        nowIndicator={true}
        locale="ja"
        allDaySlot={false}
        // Events
        events={events}
        eventContent={renderEventContent}
        eventOverlap={false}
        // インタラクション
        selectable={true}
        selectMirror={true}
        editable={true}
        eventDurationEditable={false}
        longPressDelay={300}
        selectLongPressDelay={300}
        eventLongPressDelay={500}
        // Callbacks
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        datesSet={handleDatesSet}
        // レスポンシブ
        stickyHeaderDates={true}
        // 週表示の場合の追加設定
        views={{
          resourceTimeGridWeek: {
            slotDuration: '00:30:00',
            slotLabelInterval: '01:00:00',
          },
        }}
      />
    </div>
  )
}
