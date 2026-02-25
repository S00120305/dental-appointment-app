'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useStaff } from '@/hooks/useStaff'
import {
  HOLIDAY_TYPE_LABELS,
  HOLIDAY_TYPE_COLORS,
  type StaffHoliday,
} from '@/hooks/useStaffHolidays'

type HolidayType = 'paid_leave' | 'day_off' | 'half_day_am' | 'half_day_pm' | 'other'

const HOLIDAY_TYPES: HolidayType[] = ['paid_leave', 'day_off', 'half_day_am', 'half_day_pm', 'other']

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StaffHolidaysPage() {
  const { showToast } = useToast()
  const { staffList, isLoading: staffLoading } = useStaff()

  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [holidays, setHolidays] = useState<StaffHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string, Record<string, number>>>({})

  // Popover state
  const [popoverDate, setPopoverDate] = useState<string | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Select first staff on load
  useEffect(() => {
    if (staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].id)
    }
  }, [staffList, selectedStaffId])

  // Fetch holidays when staff or month changes
  const fetchHolidays = useCallback(async () => {
    if (!selectedStaffId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff-holidays?user_id=${selectedStaffId}&year=${currentYear}&month=${currentMonth}`)
      const data = await res.json()
      if (res.ok) setHolidays(data.staff_holidays || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedStaffId, currentYear, currentMonth])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff-holidays/summary?year=${currentYear}&month=${currentMonth}`)
      const data = await res.json()
      if (res.ok) setSummary(data.summary || {})
    } catch { /* ignore */ }
  }, [currentYear, currentMonth])

  useEffect(() => {
    fetchHolidays()
    fetchSummary()
  }, [fetchHolidays, fetchSummary])

  // Holiday map for selected staff: date → StaffHoliday
  const holidayMap = useMemo(() => {
    const map: Record<string, StaffHoliday> = {}
    for (const h of holidays) {
      map[h.holiday_date] = h
    }
    return map
  }, [holidays])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const lastDay = new Date(currentYear, currentMonth, 0)
    const startDow = firstDay.getDay()
    const days: (string | null)[] = []

    // Fill leading blanks
    for (let i = 0; i < startDow; i++) days.push(null)
    // Fill actual days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(formatDate(new Date(currentYear, currentMonth - 1, d)))
    }
    return days
  }, [currentYear, currentMonth])

  async function handleDateClick(dateStr: string, e: React.MouseEvent) {
    if (popoverDate === dateStr) {
      setPopoverDate(null)
      return
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 4 })
    setPopoverDate(dateStr)
  }

  async function handleSetHoliday(dateStr: string, type: HolidayType) {
    if (!selectedStaffId) return
    try {
      const res = await fetch('/api/staff-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedStaffId, holiday_date: dateStr, holiday_type: type }),
      })
      if (res.ok) {
        showToast('休日を設定しました', 'success')
        fetchHolidays()
        fetchSummary()
      } else {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
      }
    } catch {
      showToast('通信エラー', 'error')
    }
    setPopoverDate(null)
  }

  async function handleRemoveHoliday(id: string) {
    try {
      const res = await fetch(`/api/staff-holidays?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('休日を解除しました', 'success')
        fetchHolidays()
        fetchSummary()
      } else {
        showToast('エラーが発生しました', 'error')
      }
    } catch {
      showToast('通信エラー', 'error')
    }
    setPopoverDate(null)
  }

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setPopoverDate(null)
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setPopoverDate(null)
  }

  const selectedStaff = staffList.find(s => s.id === selectedStaffId)
  const staffSummary = selectedStaffId ? summary[selectedStaffId] : null

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">スタッフ休日管理</h1>
          <Button variant="secondary" onClick={() => window.history.back()}>戻る</Button>
        </div>

        {/* スタッフ選択 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">スタッフ</label>
          {staffLoading ? (
            <div className="h-10 animate-pulse rounded-md bg-gray-200" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {staffList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStaffId(s.id); setPopoverDate(null) }}
                  className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedStaffId === s.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s.name}
                  {summary[s.id] && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                      selectedStaffId === s.id ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {summary[s.id].total || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStaff && (
          <>
            {/* 月別サマリー */}
            {staffSummary && staffSummary.total > 0 && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {currentYear}年{currentMonth}月 {selectedStaff.name} の休日
                </h3>
                <div className="flex flex-wrap gap-3">
                  {HOLIDAY_TYPES.map(type => {
                    const count = staffSummary[type] || 0
                    if (count === 0) return null
                    return (
                      <div key={type} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: HOLIDAY_TYPE_COLORS[type] }}
                        />
                        <span className="text-sm text-gray-600">
                          {HOLIDAY_TYPE_LABELS[type]}: {count}日
                        </span>
                      </div>
                    )
                  })}
                  <div className="text-sm font-medium text-gray-700">
                    計 {staffSummary.total}日
                  </div>
                </div>
              </div>
            )}

            {/* カレンダー */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 relative">
              {/* 月ナビゲーション */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={handlePrevMonth}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-bold text-gray-900">
                  {currentYear}年{currentMonth}月
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['日', '月', '火', '水', '木', '金', '土'].map((dow, i) => (
                  <div
                    key={dow}
                    className={`text-center text-xs font-medium py-1 ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                    }`}
                  >
                    {dow}
                  </div>
                ))}
              </div>

              {/* カレンダーグリッド */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dateStr, i) => {
                  if (!dateStr) {
                    return <div key={`blank-${i}`} className="aspect-square" />
                  }
                  const day = parseInt(dateStr.slice(8, 10))
                  const dow = new Date(dateStr + 'T00:00:00').getDay()
                  const holiday = holidayMap[dateStr]
                  const isToday = dateStr === formatDate(new Date())

                  return (
                    <button
                      key={dateStr}
                      onClick={(e) => handleDateClick(dateStr, e)}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors min-h-[44px] ${
                        holiday
                          ? 'ring-2 ring-offset-1'
                          : 'hover:bg-gray-100'
                      } ${isToday ? 'font-bold' : ''} ${
                        dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'
                      }`}
                      style={holiday ? {
                        backgroundColor: HOLIDAY_TYPE_COLORS[holiday.holiday_type] + '20',
                        ['--tw-ring-color' as string]: HOLIDAY_TYPE_COLORS[holiday.holiday_type],
                      } : undefined}
                    >
                      <span className={isToday ? 'rounded-full bg-emerald-600 text-white px-1.5 py-0.5 text-xs' : ''}>
                        {day}
                      </span>
                      {holiday && (
                        <span
                          className="mt-0.5 text-[10px] font-medium leading-tight"
                          style={{ color: HOLIDAY_TYPE_COLORS[holiday.holiday_type] }}
                        >
                          {HOLIDAY_TYPE_LABELS[holiday.holiday_type]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* ポップオーバー */}
              {popoverDate && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPopoverDate(null)} />
                  <div
                    className="fixed z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
                    style={{
                      left: Math.min(popoverPosition.x - 100, window.innerWidth - 220),
                      top: Math.min(popoverPosition.y, window.innerHeight - 300),
                      width: 200,
                    }}
                  >
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      {popoverDate.replace(/-/g, '/')}
                    </p>
                    <div className="space-y-1">
                      {HOLIDAY_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => handleSetHoliday(popoverDate, type)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 min-h-[36px]"
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: HOLIDAY_TYPE_COLORS[type] }}
                          />
                          {HOLIDAY_TYPE_LABELS[type]}
                        </button>
                      ))}
                      {holidayMap[popoverDate] && (
                        <>
                          <hr className="my-1 border-gray-200" />
                          <button
                            onClick={() => handleRemoveHoliday(holidayMap[popoverDate].id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 min-h-[36px]"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            休日を解除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
                  <span className="text-gray-400 text-sm">読み込み中...</span>
                </div>
              )}
            </div>

            {/* 凡例 */}
            <div className="mt-3 flex flex-wrap gap-3">
              {HOLIDAY_TYPES.map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: HOLIDAY_TYPE_COLORS[type] }}
                  />
                  <span className="text-xs text-gray-500">{HOLIDAY_TYPE_LABELS[type]}</span>
                </div>
              ))}
            </div>

            {/* 登録済み休日一覧 */}
            {holidays.length > 0 && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-white">
                <h3 className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
                  {currentYear}年{currentMonth}月の登録済み休日（{holidays.length}件）
                </h3>
                <div className="divide-y divide-gray-100">
                  {holidays.map((h) => {
                    const d = new Date(h.holiday_date + 'T00:00:00')
                    const DOW = ['日', '月', '火', '水', '木', '金', '土']
                    return (
                      <div key={h.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: HOLIDAY_TYPE_COLORS[h.holiday_type] }}
                          />
                          <span className="text-sm text-gray-700">
                            {d.getMonth() + 1}/{d.getDate()}（{DOW[d.getDay()]}）
                          </span>
                          <span className="text-sm font-medium" style={{ color: HOLIDAY_TYPE_COLORS[h.holiday_type] }}>
                            {HOLIDAY_TYPE_LABELS[h.holiday_type]}
                          </span>
                          {h.label && <span className="text-xs text-gray-400">{h.label}</span>}
                        </div>
                        <button
                          onClick={() => handleRemoveHoliday(h.id)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
