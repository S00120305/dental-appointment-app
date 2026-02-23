'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import AppLayout from '@/components/layout/AppLayout'
import AppointmentModal from '@/components/calendar/AppointmentModal'
import BlockedSlotModal from '@/components/calendar/BlockedSlotModal'
import SlotActionMenu from '@/components/calendar/SlotActionMenu'
import AvailableSlotSearch from '@/components/calendar/AvailableSlotSearch'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useAppointments } from '@/hooks/useAppointments'
import { useSettings } from '@/hooks/useSettings'
import { useStaff } from '@/hooks/useStaff'
import type { AppointmentWithRelations, BlockedSlot } from '@/lib/supabase/types'
import type { CalendarResource } from '@/components/calendar/CalendarView'

const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), { ssr: false })

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type ViewType = 'resourceTimeGridDay' | 'resourceTimeGridWeek'

export default function CalendarPage() {
  const {
    appointments,
    loading,
    fetchAppointments,
    refreshAppointments,
    updateStatus,
    moveAppointment,
    addAppointment,
    removeAppointment,
  } = useAppointments()

  const { unitCount, businessHours, staffColors, isLoading: settingsLoading } = useSettings()
  const { staffList } = useStaff()

  // State
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()))
  const [viewType, setViewType] = useState<ViewType>('resourceTimeGridDay')

  // Appointment Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)
  const [defaultModalDate, setDefaultModalDate] = useState<string>('')
  const [defaultModalTime, setDefaultModalTime] = useState<string>('')
  const [defaultModalUnit, setDefaultModalUnit] = useState<number>(1)

  // Blocked Slots
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [selectedBlockedSlot, setSelectedBlockedSlot] = useState<BlockedSlot | null>(null)
  const [defaultBlockDate, setDefaultBlockDate] = useState<string>('')
  const [defaultBlockStartTime, setDefaultBlockStartTime] = useState<string>('')
  const [defaultBlockEndTime, setDefaultBlockEndTime] = useState<string>('')
  const [defaultBlockUnit, setDefaultBlockUnit] = useState<number>(0)

  // Slot Action Menu
  const [slotActionMenu, setSlotActionMenu] = useState<{
    open: boolean
    position: { x: number; y: number }
    date: string
    time: string
    endTime: string
    unit: number
  }>({ open: false, position: { x: 0, y: 0 }, date: '', time: '', endTime: '', unit: 1 })

  // Available Slot Search
  const [slotSearchOpen, setSlotSearchOpen] = useState(false)
  const [defaultModalDuration, setDefaultModalDuration] = useState<number | undefined>(undefined)

  // Unit filter (mobile)
  const [filteredUnit, setFilteredUnit] = useState<number | null>(null)

  // Resources
  const resources: CalendarResource[] = useMemo(() => {
    if (filteredUnit) {
      return [{ id: String(filteredUnit), title: `ユニット${filteredUnit}` }]
    }
    return Array.from({ length: unitCount }, (_, i) => ({
      id: String(i + 1),
      title: `U${i + 1}`,
    }))
  }, [unitCount, filteredUnit])

  // Date range for fetching (use ref to avoid re-render loops)
  const fetchRangeRef = useRef<string>('')

  // Fetch blocked slots
  const fetchBlockedSlots = useCallback(async (startDate: string, endDate: string) => {
    try {
      const res = await fetch(`/api/blocked-slots?start_date=${startDate}&end_date=${endDate}`)
      const data = await res.json()
      if (res.ok) {
        setBlockedSlots(data.blocked_slots || [])
      }
    } catch {
      // silent fail
    }
  }, [])

  // Calendar callbacks
  const handleDatesSet = useCallback((start: Date, end: Date) => {
    const startStr = formatDateLocal(start)
    const endDate = new Date(end.getTime() - 1)
    const endStr = formatDateLocal(endDate)
    const rangeKey = `${startStr}_${endStr}`
    if (fetchRangeRef.current !== rangeKey) {
      fetchRangeRef.current = rangeKey
      fetchAppointments(startStr, endStr)
      fetchBlockedSlots(startStr, endStr)
    }
  }, [fetchAppointments, fetchBlockedSlots])

  const handleDateSelect = useCallback((start: Date, end: Date, resourceId: string) => {
    const dateStr = formatDateLocal(start)
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    const unit = parseInt(resourceId) || 1

    // SlotActionMenu を表示
    // マウスイベントの位置を取得（ない場合は画面中央）
    const lastEvent = window.event as MouseEvent | TouchEvent | null
    let x = window.innerWidth / 2
    let y = window.innerHeight / 3
    if (lastEvent) {
      if ('clientX' in lastEvent) {
        x = lastEvent.clientX
        y = lastEvent.clientY
      } else if (lastEvent.touches?.length > 0) {
        x = lastEvent.touches[0].clientX
        y = lastEvent.touches[0].clientY
      }
    }

    setSlotActionMenu({
      open: true,
      position: { x, y },
      date: dateStr,
      time: timeStr,
      endTime: endTimeStr,
      unit,
    })
  }, [])

  const handleSlotActionAppointment = useCallback(() => {
    setSelectedAppointment(null)
    setDefaultModalDate(slotActionMenu.date)
    setDefaultModalTime(slotActionMenu.time)
    setDefaultModalUnit(slotActionMenu.unit)
    setDefaultModalDuration(undefined)
    setModalOpen(true)
  }, [slotActionMenu])

  const handleSlotActionBlock = useCallback(() => {
    setSelectedBlockedSlot(null)
    setDefaultBlockDate(slotActionMenu.date)
    setDefaultBlockStartTime(slotActionMenu.time)
    setDefaultBlockEndTime(slotActionMenu.endTime)
    setDefaultBlockUnit(slotActionMenu.unit)
    setBlockModalOpen(true)
  }, [slotActionMenu])

  const handleEventClick = useCallback((appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId)
    if (appt) {
      setSelectedAppointment(appt)
      setModalOpen(true)
    }
  }, [appointments])

  const handleBlockedSlotClick = useCallback((slot: BlockedSlot) => {
    setSelectedBlockedSlot(slot)
    setBlockModalOpen(true)
  }, [])

  const handleEventDrop = useCallback(
    async (appointmentId: string, newStart: Date, newResourceId: string, revert: () => void) => {
      await moveAppointment(appointmentId, newStart, newResourceId, revert)
    },
    [moveAppointment]
  )

  function handleSaved(savedAppointment?: AppointmentWithRelations) {
    if (savedAppointment) {
      const exists = appointments.some(a => a.id === savedAppointment.id)
      if (exists) {
        refreshAppointments()
      } else {
        addAppointment(savedAppointment)
      }
    } else {
      refreshAppointments()
    }
  }

  function handleDeleted(id: string) {
    removeAppointment(id)
  }

  function handleBlockSaved() {
    const range = fetchRangeRef.current.split('_')
    if (range.length === 2) {
      fetchBlockedSlots(range[0], range[1])
    }
  }

  function handleBlockDeleted() {
    const range = fetchRangeRef.current.split('_')
    if (range.length === 2) {
      fetchBlockedSlots(range[0], range[1])
    }
  }

  function handleAvailableSlotSelect(
    slot: { date: string; unit_number: number; start_time: string },
    durationMinutes: number
  ) {
    const startDate = new Date(slot.start_time)
    const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    setSelectedAppointment(null)
    setDefaultModalDate(slot.date)
    setDefaultModalTime(timeStr)
    setDefaultModalUnit(slot.unit_number)
    setDefaultModalDuration(durationMinutes)
    setSlotSearchOpen(false)
    setModalOpen(true)
  }

  function handleNewAppointment() {
    setSelectedAppointment(null)
    setDefaultModalDate(selectedDate)
    setDefaultModalTime('')
    setDefaultModalUnit(1)
    setDefaultModalDuration(undefined)
    setModalOpen(true)
  }

  function handleDateChange(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(formatDateLocal(d))
  }

  function handleGoToday() {
    setSelectedDate(formatDateLocal(new Date()))
  }

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]

  return (
    <AppLayout>
      <div className="p-2 sm:p-4">
        {/* 上部コントロール */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {/* 日付ナビゲーション */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDateChange(-1)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            />
            <button
              onClick={() => handleDateChange(1)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={handleGoToday}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
            >
              今日
            </button>
          </div>

          {/* 日付表示 */}
          <span className="text-sm font-medium text-gray-700">
            {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
          </span>

          {/* 表示切替 */}
          <div className="flex rounded-md border border-gray-300">
            <button
              onClick={() => setViewType('resourceTimeGridDay')}
              className={`min-h-[44px] px-3 text-sm ${
                viewType === 'resourceTimeGridDay'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-l-md`}
            >
              日
            </button>
            <button
              onClick={() => setViewType('resourceTimeGridWeek')}
              className={`min-h-[44px] px-3 text-sm ${
                viewType === 'resourceTimeGridWeek'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-r-md border-l border-gray-300`}
            >
              週
            </button>
          </div>

          {/* 新規予約ボタン */}
          <div className="ml-auto">
            <Button onClick={handleNewAppointment}>新規予約</Button>
          </div>
        </div>

        {/* ユニットフィルター（モバイル/タブレット） */}
        <div className="mb-2 flex gap-1 overflow-x-auto sm:hidden">
          <button
            onClick={() => setFilteredUnit(null)}
            className={`min-h-[36px] flex-shrink-0 rounded-full px-3 text-xs font-medium ${
              filteredUnit === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            全て
          </button>
          {Array.from({ length: unitCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setFilteredUnit(filteredUnit === n ? null : n)}
              className={`min-h-[36px] flex-shrink-0 rounded-full px-3 text-xs font-medium ${
                filteredUnit === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              U{n}
            </button>
          ))}
        </div>

        {/* カレンダー本体 */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden relative">
          {settingsLoading ? (
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-8 flex-1" />
                ))}
              </div>
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                  <div className="text-gray-400">読み込み中...</div>
                </div>
              )}
              <CalendarView
                appointments={appointments}
                blockedSlots={blockedSlots}
                resources={resources}
                businessHours={businessHours}
                staffColors={staffColors}
                staffList={staffList}
                initialDate={selectedDate}
                viewType={viewType}
                onDateSelect={handleDateSelect}
                onEventClick={handleEventClick}
                onBlockedSlotClick={handleBlockedSlotClick}
                onEventDrop={handleEventDrop}
                onDatesSet={handleDatesSet}
              />
            </>
          )}
        </div>
      </div>

      {/* 空き枠検索フローティングボタン */}
      <button
        onClick={() => setSlotSearchOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex min-h-[48px] items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-blue-700 active:bg-blue-800 safe-area-bottom"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        空き枠検索
      </button>

      {/* 空き枠検索パネル */}
      <AvailableSlotSearch
        isOpen={slotSearchOpen}
        onClose={() => setSlotSearchOpen(false)}
        onSelectSlot={handleAvailableSlotSelect}
        unitCount={unitCount}
      />

      {/* SlotActionMenu */}
      <SlotActionMenu
        isOpen={slotActionMenu.open}
        position={slotActionMenu.position}
        onSelectAppointment={handleSlotActionAppointment}
        onSelectBlock={handleSlotActionBlock}
        onClose={() => setSlotActionMenu((prev) => ({ ...prev, open: false }))}
      />

      {/* 予約モーダル */}
      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onStatusChange={updateStatus}
        appointment={selectedAppointment}
        defaultDate={defaultModalDate}
        defaultUnitNumber={defaultModalUnit}
        defaultStartTime={defaultModalTime}
        defaultDuration={defaultModalDuration}
      />

      {/* ブロック枠モーダル */}
      <BlockedSlotModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onSaved={handleBlockSaved}
        onDeleted={handleBlockDeleted}
        blockedSlot={selectedBlockedSlot}
        defaultDate={defaultBlockDate}
        defaultStartTime={defaultBlockStartTime}
        defaultEndTime={defaultBlockEndTime}
        defaultUnitNumber={defaultBlockUnit}
        unitCount={unitCount}
        businessHours={{ start: businessHours.start, end: businessHours.end }}
      />
    </AppLayout>
  )
}
