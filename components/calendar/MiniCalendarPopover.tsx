'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

type Props = {
  selectedDate: string // YYYY-MM-DD
  onDateSelect: (dateStr: string) => void
  isHoliday: (dateStr: string) => boolean
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function MiniCalendarPopover({ selectedDate, onDateSelect, isHoliday }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate])
  const [viewYear, setViewYear] = useState(selectedDateObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDateObj.getMonth()) // 0-indexed

  // Sync view to selected date when it changes externally
  useEffect(() => {
    setViewYear(selectedDateObj.getFullYear())
    setViewMonth(selectedDateObj.getMonth())
  }, [selectedDateObj])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const todayStr = useMemo(() => formatDateLocal(new Date()), [])

  const DOW = ['日', '月', '火', '水', '木', '金', '土']

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const days: { dateStr: string; day: number; isCurrentMonth: boolean }[] = []

    // Previous month padding
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const date = new Date(viewYear, viewMonth - 1, d)
      days.push({ dateStr: formatDateLocal(date), day: d, isCurrentMonth: false })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      days.push({ dateStr: formatDateLocal(date), day: d, isCurrentMonth: true })
    }

    // Next month padding (fill to 6 rows)
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(viewYear, viewMonth + 1, d)
      days.push({ dateStr: formatDateLocal(date), day: d, isCurrentMonth: false })
    }

    return days
  }, [viewYear, viewMonth])

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }, [viewMonth])

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }, [viewMonth])

  const handleDateClick = useCallback((dateStr: string) => {
    onDateSelect(dateStr)
    setOpen(false)
  }, [onDateSelect])

  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][selectedDateObj.getDay()]

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50"
      >
        {selectedDateObj.getFullYear()}/{selectedDateObj.getMonth() + 1}/{selectedDateObj.getDate()}（{dayOfWeek}）
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          {/* Month/Year navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-bold text-gray-800">
              {viewYear}年{viewMonth + 1}月
            </span>
            <button
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0">
            {DOW.map((d, i) => (
              <div
                key={d}
                className={`flex h-8 w-9 items-center justify-center text-xs font-medium ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map((day, idx) => {
              const isSelected = day.dateStr === selectedDate
              const isToday = day.dateStr === todayStr
              const holiday = day.isCurrentMonth && isHoliday(day.dateStr)
              const dayOfWeekIdx = idx % 7

              return (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day.dateStr)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors
                    ${!day.isCurrentMonth ? 'text-gray-300' : ''}
                    ${day.isCurrentMonth && !isSelected && !holiday && dayOfWeekIdx === 0 ? 'text-red-500' : ''}
                    ${day.isCurrentMonth && !isSelected && !holiday && dayOfWeekIdx === 6 ? 'text-blue-500' : ''}
                    ${day.isCurrentMonth && holiday && !isSelected ? 'text-red-500' : ''}
                    ${isSelected ? 'bg-emerald-600 font-bold text-white' : ''}
                    ${isToday && !isSelected ? 'font-bold ring-1 ring-emerald-400' : ''}
                    ${day.isCurrentMonth && !isSelected ? 'hover:bg-gray-100' : ''}
                  `}
                >
                  {day.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
