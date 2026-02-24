'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00',
]

export default function WebBookingSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [minDaysAhead, setMinDaysAhead] = useState('1')
  const [maxDaysAhead, setMaxDaysAhead] = useState('90')
  const [deadlineTime, setDeadlineTime] = useState('18:00')
  const [cancelDeadlineTime, setCancelDeadlineTime] = useState('18:00')
  const [maxActiveBookings, setMaxActiveBookings] = useState('3')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        const s = data.settings
        if (s.web_booking_min_days_ahead) setMinDaysAhead(s.web_booking_min_days_ahead)
        if (s.web_booking_max_days_ahead) setMaxDaysAhead(s.web_booking_max_days_ahead)
        if (s.web_booking_deadline_time) setDeadlineTime(s.web_booking_deadline_time)
        if (s.web_cancel_deadline_time) setCancelDeadlineTime(s.web_cancel_deadline_time)
        if (s.web_max_active_bookings) setMaxActiveBookings(s.web_max_active_bookings)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function saveSetting(key: string, value: string) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) throw new Error('設定の保存に失敗しました')
  }

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        saveSetting('web_booking_min_days_ahead', minDaysAhead),
        saveSetting('web_booking_max_days_ahead', maxDaysAhead),
        saveSetting('web_booking_deadline_time', deadlineTime),
        saveSetting('web_cancel_deadline_time', cancelDeadlineTime),
        saveSetting('web_max_active_bookings', maxActiveBookings),
      ])
      showToast('設定を保存しました', 'success')
    } catch {
      showToast('設定の保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">Web予約設定</h1>
          <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Web予約設定</h1>

        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          {/* 予約可能期間 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">予約可能期間</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">最短（何日後から）</label>
                <div className="flex items-center gap-2">
                  <select
                    value={minDaysAhead}
                    onChange={e => setMinDaysAhead(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-base"
                  >
                    {[0, 1, 2, 3, 5, 7].map(d => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">日後から予約可能</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">最長（何日先まで）</label>
                <div className="flex items-center gap-2">
                  <select
                    value={maxDaysAhead}
                    onChange={e => setMaxDaysAhead(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-base"
                  >
                    {[14, 30, 60, 90, 120, 180].map(d => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">日先まで予約可能</span>
                </div>
              </div>
            </div>
          </div>

          {/* 予約締切 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">予約締切</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">前日</span>
              <select
                value={deadlineTime}
                onChange={e => setDeadlineTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">まで</span>
            </div>
          </div>

          {/* 変更・キャンセル期限 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">変更・キャンセル期限</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">前日</span>
              <select
                value={cancelDeadlineTime}
                onChange={e => setCancelDeadlineTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">まで</span>
            </div>
          </div>

          {/* 同時予約上限 */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700">同時予約上限</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">1患者あたり最大</span>
              <select
                value={maxActiveBookings}
                onChange={e => setMaxActiveBookings(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-base"
              >
                {[1, 2, 3, 5, 10].map(n => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">件</span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
