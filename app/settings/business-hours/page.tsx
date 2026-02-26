'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const TIME_OPTIONS: string[] = []
for (let h = 7; h <= 21; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

export default function BusinessHoursSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [start, setStart] = useState('09:30')
  const [lunchStart, setLunchStart] = useState('13:00')
  const [lunchEnd, setLunchEnd] = useState('14:00')
  const [end, setEnd] = useState('18:00')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings?.business_hours) {
        try {
          const bh = JSON.parse(data.settings.business_hours)
          if (bh.start) setStart(bh.start)
          if (bh.lunch_start) setLunchStart(bh.lunch_start)
          if (bh.lunch_end) setLunchEnd(bh.lunch_end)
          if (bh.end) setEnd(bh.end)
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function handleSave() {
    // バリデーション
    if (start >= lunchStart) {
      showToast('午前開始は午前終了より前に設定してください', 'error')
      return
    }
    if (lunchStart >= lunchEnd) {
      showToast('昼休み開始は昼休み終了より前に設定してください', 'error')
      return
    }
    if (lunchEnd >= end) {
      showToast('午後開始は午後終了より前に設定してください', 'error')
      return
    }

    setSaving(true)
    try {
      const value = JSON.stringify({ start, end, lunch_start: lunchStart, lunch_end: lunchEnd })
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'business_hours', value }),
      })
      if (!res.ok) throw new Error()
      showToast('診療時間を保存しました', 'success')
    } catch {
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">診療時間設定</h1>
          <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <a
            href="/settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-2xl font-bold text-gray-900">診療時間設定</h1>
        </div>

        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          {/* 午前 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">午前診療</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={start}
                onChange={e => setStart(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-gray-500">〜</span>
              <select
                value={lunchStart}
                onChange={e => setLunchStart(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 昼休み */}
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm text-gray-500">
              昼休み: {lunchStart} 〜 {lunchEnd}
            </p>
          </div>

          {/* 午後 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">午後診療</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={lunchEnd}
                onChange={e => setLunchEnd(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-gray-500">〜</span>
              <select
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
            この設定はカレンダー表示範囲・Web予約の空き枠計算・フッター表記に反映されます。
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
