'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'

type AvailableSlot = {
  date: string
  unit_number: number
  start_time: string
  end_time: string
  duration_minutes: number
}

type AvailableSlotSearchProps = {
  isOpen: boolean
  onClose: () => void
  onSelectSlot: (slot: AvailableSlot, durationMinutes: number) => void
  visibleUnits: number[]
  preSelectedPatientId?: string
  preSelectedPatientName?: string
}

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90]

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDateLocal(d)
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${month}月${day}日（${dow}）`
}

export default function AvailableSlotSearch({
  isOpen,
  onClose,
  onSelectSlot,
  visibleUnits,
  preSelectedPatientId,
  preSelectedPatientName,
}: AvailableSlotSearchProps) {
  const tomorrow = formatDateLocal(new Date(Date.now() + 24 * 60 * 60 * 1000))

  const [startDate, setStartDate] = useState(tomorrow)
  const [endDate, setEndDate] = useState(addDays(tomorrow, 14))
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [unitNumber, setUnitNumber] = useState(0)
  const [timeRange, setTimeRange] = useState<'all' | 'morning' | 'afternoon' | 'custom'>('all')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [customTimeStart, setCustomTimeStart] = useState('')
  const [customTimeEnd, setCustomTimeEnd] = useState('')

  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      const t = formatDateLocal(new Date(Date.now() + 24 * 60 * 60 * 1000))
      setStartDate(t)
      setEndDate(addDays(t, 14))
      setDurationMinutes(30)
      setUnitNumber(0)
      setTimeRange('all')
      setSelectedDays([])
      setCustomTimeStart('')
      setCustomTimeEnd('')
      setSlots([])
      setTotal(0)
      setHasMore(false)
      setSearched(false)
    }
  }, [isOpen])

  async function handleSearch() {
    // 期間バリデーション
    const s = new Date(startDate + 'T00:00:00')
    const e = new Date(endDate + 'T00:00:00')
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diff < 1) return
    if (diff > 30) {
      setEndDate(addDays(startDate, 29))
      return
    }

    setSearching(true)
    setSearched(false)
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        duration_minutes: String(durationMinutes),
        unit_number: String(unitNumber),
        time_range: timeRange,
      })
      if (selectedDays.length > 0) {
        params.set('days_of_week', selectedDays.join(','))
      }
      if (timeRange === 'custom' && customTimeStart && customTimeEnd) {
        params.set('time_start', customTimeStart)
        params.set('time_end', customTimeEnd)
      }
      const res = await fetch(`/api/appointments/available-slots?${params}`)
      const data = await res.json()
      if (res.ok) {
        setSlots(data.slots || [])
        setTotal(data.total || 0)
        setHasMore(data.has_more || false)
      }
    } catch {
      // silent
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  // 日付ごとにグループ化
  const groupedSlots = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold">空き枠検索</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">
            &#x2715;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* 患者プリセット表示 */}
          {preSelectedPatientId && preSelectedPatientName && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              {preSelectedPatientName} さんの次回予約
            </div>
          )}

          {/* 検索フォーム */}
          <div className="space-y-3">
            {/* 開始日・終了日 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* 必要時間・ユニット */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">必要時間</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}分</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">診察室</label>
                <select
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(parseInt(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={0}>全診察室</option>
                  {visibleUnits.map((n) => (
                    <option key={n} value={n}>診察室{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 時間帯 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">時間帯</label>
              <div className="flex gap-2">
                {([
                  { value: 'all', label: '終日' },
                  { value: 'morning', label: '午前' },
                  { value: 'afternoon', label: '午後' },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-md border text-sm ${
                      timeRange === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                        : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="time_range"
                      value={opt.value}
                      checked={timeRange === opt.value}
                      onChange={() => { setTimeRange(opt.value); setCustomTimeStart(''); setCustomTimeEnd('') }}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 詳細時間指定 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">詳細時間指定</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={customTimeStart}
                  onChange={(e) => {
                    setCustomTimeStart(e.target.value)
                    if (e.target.value && customTimeEnd) setTimeRange('custom')
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
                />
                <span className="text-gray-400">〜</span>
                <input
                  type="time"
                  value={customTimeEnd}
                  onChange={(e) => {
                    setCustomTimeEnd(e.target.value)
                    if (customTimeStart && e.target.value) setTimeRange('custom')
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
                />
                {(customTimeStart || customTimeEnd) && (
                  <button
                    type="button"
                    onClick={() => { setCustomTimeStart(''); setCustomTimeEnd(''); if (timeRange === 'custom') setTimeRange('all') }}
                    className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    ✕
                  </button>
                )}
              </div>
              {timeRange === 'custom' && (
                <p className="mt-1 text-xs text-emerald-600">詳細時間指定が優先されます</p>
              )}
            </div>

            {/* 曜日指定 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">曜日指定</label>
              <div className="flex gap-1.5">
                {([
                  { day: 1, label: '月' },
                  { day: 2, label: '火' },
                  { day: 3, label: '水' },
                  { day: 4, label: '木' },
                  { day: 5, label: '金' },
                  { day: 6, label: '土' },
                ] as const).map((opt) => {
                  const isSelected = selectedDays.includes(opt.day)
                  return (
                    <button
                      key={opt.day}
                      type="button"
                      onClick={() => {
                        setSelectedDays(prev =>
                          isSelected ? prev.filter(d => d !== opt.day) : [...prev, opt.day].sort()
                        )
                      }}
                      className={`min-h-[44px] min-w-[44px] flex-1 rounded-md border text-sm font-medium ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {selectedDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDays([])}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  曜日指定をクリア
                </button>
              )}
            </div>

            {/* 検索ボタン */}
            <Button onClick={handleSearch} disabled={searching} className="w-full">
              {searching ? '検索中...' : '検索'}
            </Button>
          </div>

          {/* 検索結果 */}
          {searched && (
            <div className="border-t border-gray-200 pt-4">
              {slots.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-2">検索結果がありません。</p>
                  <p className="text-xs text-gray-400">
                    条件を変更してお試しください。
                  </p>
                  <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <li>- 期間を広げる</li>
                    <li>- 必要時間を短くする</li>
                    <li>- 診察室指定を外す</li>
                  </ul>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      結果: {total}件{hasMore && `（${MAX_DISPLAY}件まで表示）`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(groupedSlots).map(([date, daySlots]) => (
                      <div key={date}>
                        <h3 className="mb-1 text-sm font-medium text-gray-800">
                          {formatDateDisplay(date)}
                        </h3>
                        <div className="space-y-1">
                          {daySlots.map((slot, idx) => (
                            <button
                              key={`${slot.unit_number}-${idx}`}
                              onClick={() => onSelectSlot(slot, durationMinutes)}
                              className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-emerald-50 min-h-[44px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                                  診{slot.unit_number}
                                </span>
                                <span className="text-gray-900">
                                  {formatTime(slot.start_time)}〜{formatTime(slot.end_time)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  （{slot.duration_minutes}分）
                                </span>
                              </div>
                              <span className="text-emerald-500 text-lg">&#x25B6;</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <p className="mt-3 text-center text-xs text-gray-400">
                      表示件数を超える結果があります。期間を絞り込んでください。
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ローディング */}
          {searching && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span className="ml-2 text-sm text-gray-500">検索中...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MAX_DISPLAY = 20
