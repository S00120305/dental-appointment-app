'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useToast } from '@/components/ui/Toast'

type Holiday = {
  id: string
  holiday_type: 'weekly' | 'specific' | 'national'
  day_of_week: number | null
  specific_date: string | null
  label: string | null
  is_active: boolean
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default function HolidaysSettingsPage() {
  const { showToast } = useToast()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyDays, setWeeklyDays] = useState<Set<number>>(new Set())
  const [savingWeekly, setSavingWeekly] = useState(false)

  // Mini calendar state
  const today = new Date()
  const [calendarBaseMonth, setCalendarBaseMonth] = useState(
    today.getFullYear() * 12 + today.getMonth()
  )

  // Add specific holiday dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Year for display
  const [displayYear, setDisplayYear] = useState(today.getFullYear())

  const fetchHolidays = useCallback(async (year?: number) => {
    try {
      const y = year || displayYear
      const res = await fetch(`/api/clinic-holidays?year=${y}`)
      const data = await res.json()
      if (res.ok) {
        setHolidays(data.holidays || [])
        // Extract weekly days
        const weekly = new Set<number>()
        for (const h of data.holidays || []) {
          if (h.holiday_type === 'weekly' && h.day_of_week !== null) {
            weekly.add(h.day_of_week)
          }
        }
        setWeeklyDays(weekly)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [displayYear])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  // Derived data
  const nationalHolidays = useMemo(
    () => holidays.filter(h => h.holiday_type === 'national'),
    [holidays]
  )
  const specificHolidays = useMemo(
    () => holidays.filter(h => h.holiday_type === 'specific').sort((a, b) =>
      (a.specific_date || '').localeCompare(b.specific_date || '')
    ),
    [holidays]
  )

  // Holiday date set for quick lookup
  const holidayDateMap = useMemo(() => {
    const map: Record<string, Holiday> = {}
    for (const h of holidays) {
      if (h.specific_date && h.is_active) {
        map[h.specific_date] = h
      }
    }
    return map
  }, [holidays])

  // Weekly toggle
  async function toggleWeeklyDay(dow: number) {
    const newDays = new Set(weeklyDays)
    if (newDays.has(dow)) {
      newDays.delete(dow)
    } else {
      newDays.add(dow)
    }
    setWeeklyDays(newDays)
    setSavingWeekly(true)

    try {
      const res = await fetch('/api/clinic-holidays/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: Array.from(newDays) }),
      })
      if (!res.ok) {
        showToast('定休日の更新に失敗しました', 'error')
        // Revert
        setWeeklyDays(weeklyDays)
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
      setWeeklyDays(weeklyDays)
    } finally {
      setSavingWeekly(false)
      fetchHolidays()
    }
  }

  // Toggle national holiday active
  async function toggleNationalHoliday(id: string, currentActive: boolean) {
    // Optimistic
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, is_active: !currentActive } : h))

    try {
      const res = await fetch('/api/clinic-holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      if (!res.ok) {
        showToast('更新に失敗しました', 'error')
        setHolidays(prev => prev.map(h => h.id === id ? { ...h, is_active: currentActive } : h))
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
      setHolidays(prev => prev.map(h => h.id === id ? { ...h, is_active: currentActive } : h))
    }
  }

  // Add specific holiday
  async function handleAddSpecific() {
    if (!addDate) return
    setAddSaving(true)
    try {
      const res = await fetch('/api/clinic-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specific_date: addDate, label: addLabel || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('休診日を追加しました', 'success')
      setAddDialogOpen(false)
      setAddDate('')
      setAddLabel('')
      fetchHolidays()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setAddSaving(false)
    }
  }

  // Toggle specific date via calendar click
  async function toggleSpecificDate(dateStr: string) {
    const existing = holidays.find(
      h => h.holiday_type === 'specific' && h.specific_date === dateStr
    )
    if (existing) {
      // Delete it
      try {
        const res = await fetch(`/api/clinic-holidays?id=${existing.id}`, { method: 'DELETE' })
        if (res.ok) {
          fetchHolidays()
        } else {
          showToast('削除に失敗しました', 'error')
        }
      } catch {
        showToast('通信エラーが発生しました', 'error')
      }
    } else {
      // Check if it's a national holiday — don't add specific if national exists
      const national = holidays.find(
        h => h.holiday_type === 'national' && h.specific_date === dateStr
      )
      if (national) {
        // Toggle the national holiday's is_active instead
        toggleNationalHoliday(national.id, national.is_active)
        return
      }
      // Add new specific
      try {
        const res = await fetch('/api/clinic-holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specific_date: dateStr }),
        })
        if (res.ok) {
          fetchHolidays()
        } else {
          const data = await res.json()
          showToast(data.error || 'エラーが発生しました', 'error')
        }
      } catch {
        showToast('通信エラーが発生しました', 'error')
      }
    }
  }

  // Delete specific holiday
  async function deleteSpecificHoliday(id: string) {
    try {
      const res = await fetch(`/api/clinic-holidays?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('休診日を削除しました', 'success')
        fetchHolidays()
      } else {
        showToast('削除に失敗しました', 'error')
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    }
  }

  // Mini calendar rendering
  function renderMiniCalendar(year: number, month: number) {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDow = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const cells: { day: number; dateStr: string }[] = []
    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: 0, dateStr: '' })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateStr })
    }

    const monthLabel = `${year}年${month + 1}月`

    return (
      <div key={`${year}-${month}`} className="flex-shrink-0">
        <h4 className="mb-2 text-center text-sm font-medium text-gray-700">{monthLabel}</h4>
        <div className="grid grid-cols-7 gap-0 text-center text-xs">
          {DOW_LABELS.map((d, i) => (
            <div key={i} className={`py-1 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
          {cells.map((cell, idx) => {
            if (cell.day === 0) {
              return <div key={`empty-${idx}`} className="h-8" />
            }

            const dow = new Date(year, month, cell.day).getDay()
            const isWeeklyHoliday = weeklyDays.has(dow)
            const nationalH = holidays.find(
              h => h.holiday_type === 'national' && h.specific_date === cell.dateStr
            )
            const specificH = holidays.find(
              h => h.holiday_type === 'specific' && h.specific_date === cell.dateStr
            )
            const isHoliday = holidayDateMap[cell.dateStr]
            const isToday = cell.dateStr === formatDate(today)

            let bgClass = 'bg-white hover:bg-gray-50'
            let textClass = dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-800'

            if (specificH) {
              bgClass = 'bg-red-500 hover:bg-red-600'
              textClass = 'text-white'
            } else if (nationalH && nationalH.is_active) {
              bgClass = 'bg-pink-100 hover:bg-pink-200'
              textClass = 'text-pink-800'
            } else if (nationalH && !nationalH.is_active) {
              bgClass = 'bg-pink-50 hover:bg-pink-100'
              textClass = 'text-pink-400 line-through'
            } else if (isWeeklyHoliday) {
              bgClass = 'bg-gray-200 hover:bg-gray-300'
              textClass = 'text-gray-500'
            }

            const title = specificH?.label
              || (nationalH ? `${nationalH.label}${nationalH.is_active ? '' : '（診療日）'}` : '')
              || (isWeeklyHoliday ? '定休日' : '')

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => toggleSpecificDate(cell.dateStr)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${bgClass} ${textClass} ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                title={title || undefined}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Calendar months to display (3 months from base)
  const calendarMonths = useMemo(() => {
    const months: { year: number; month: number }[] = []
    for (let i = 0; i < 3; i++) {
      const m = calendarBaseMonth + i
      months.push({ year: Math.floor(m / 12), month: m % 12 })
    }
    return months
  }, [calendarBaseMonth])

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">休診日設定</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-32 rounded-lg bg-gray-100" />
            <div className="h-64 rounded-lg bg-gray-100" />
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">休診日設定</h1>

        {/* セクション1: 定休日（曜日指定） */}
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">定休日</h2>
            <p className="text-sm text-gray-500">毎週の休診曜日を設定します</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DOW_LABELS.map((label, dow) => {
              const isSelected = weeklyDays.has(dow)
              return (
                <button
                  key={dow}
                  type="button"
                  disabled={savingWeekly}
                  onClick={() => toggleWeeklyDay(dow)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-red-500 text-white shadow-md'
                      : 'border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  } ${savingWeekly ? 'opacity-50' : ''}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            ※ 祝日や臨時出勤は、下の特定休診日セクションで個別に設定してください
          </p>
        </section>

        {/* セクション2: 特定休診日 + ミニカレンダー */}
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">特定休診日</h2>
              <p className="text-sm text-gray-500">個別の休診日・臨時休診を設定します</p>
            </div>
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="min-h-[44px] rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 休診日を追加
            </button>
          </div>

          {/* ミニカレンダー */}
          <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalendarBaseMonth(prev => prev - 1)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-700">
                {calendarMonths[0].year}年{calendarMonths[0].month + 1}月 〜 {calendarMonths[2].year}年{calendarMonths[2].month + 1}月
              </span>
              <button
                type="button"
                onClick={() => setCalendarBaseMonth(prev => prev + 1)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {calendarMonths.map(({ year, month }) => renderMiniCalendar(year, month))}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-gray-200" /> 定休日
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-pink-100 border border-pink-200" /> 祝日
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> 休診日
              </span>
            </div>
          </div>

          {/* 設定済み休診日一覧 */}
          {specificHolidays.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">設定済み休診日</h3>
              <div className="space-y-1">
                {specificHolidays.map((h) => {
                  const d = h.specific_date ? new Date(h.specific_date + 'T00:00:00') : null
                  const dow = d ? DOW_LABELS[d.getDay()] : ''
                  return (
                    <div key={h.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-sm">
                        <span className="font-medium text-gray-800">
                          {h.specific_date?.replace(/-/g, '/')}
                        </span>
                        <span className="ml-1 text-gray-500">({dow})</span>
                        {h.label && <span className="ml-2 text-gray-600">{h.label}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSpecificHoliday(h.id)}
                        className="min-h-[44px] min-w-[44px] text-red-400 hover:text-red-600"
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
        </section>

        {/* セクション3: 祝日管理 */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">祝日管理</h2>
              <p className="text-sm text-gray-500">{displayYear}年の祝日。休診にしない場合はOFFにしてください</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDisplayYear(prev => prev - 1)}
                className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50"
              >
                ◀
              </button>
              <span className="flex min-h-[44px] items-center px-2 text-sm font-medium">
                {displayYear}年
              </span>
              <button
                type="button"
                onClick={() => setDisplayYear(prev => prev + 1)}
                className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {nationalHolidays.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">{displayYear}年の祝日データがありません</p>
            ) : (
              nationalHolidays.map((h) => {
                const d = h.specific_date ? new Date(h.specific_date + 'T00:00:00') : null
                const dow = d ? DOW_LABELS[d.getDay()] : ''
                return (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      h.is_active
                        ? 'border-pink-200 bg-pink-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="text-sm">
                      <span className={`font-medium ${h.is_active ? 'text-pink-800' : 'text-gray-400 line-through'}`}>
                        {h.specific_date ? `${parseInt(h.specific_date.split('-')[1])}/${parseInt(h.specific_date.split('-')[2])}` : ''}
                      </span>
                      <span className="ml-1 text-gray-500">({dow})</span>
                      <span className={`ml-2 ${h.is_active ? 'text-gray-700' : 'text-gray-400'}`}>
                        {h.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNationalHoliday(h.id, h.is_active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-h-[44px] min-w-[44px] justify-center ${
                        h.is_active ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className="sr-only">休診にする</span>
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          h.is_active ? 'translate-x-2.5' : '-translate-x-2.5'
                        }`}
                      />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* 休診日追加ダイアログ */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">休診日を追加</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">日付 *</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ラベル（任意）</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                  placeholder="例: 夏季休暇"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setAddDialogOpen(false); setAddDate(''); setAddLabel('') }}
                className="flex-1 min-h-[44px] rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddSpecific}
                disabled={!addDate || addSaving}
                className="flex-1 min-h-[44px] rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {addSaving ? '保存中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
