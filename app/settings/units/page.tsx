'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useSettings } from '@/hooks/useSettings'

export default function UnitsSettingsPage() {
  const { showToast } = useToast()
  const { visibleUnits, mutate, isLoading } = useSettings()
  const [selectedCount, setSelectedCount] = useState(4)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setSelectedCount(visibleUnits)
    }
  }, [visibleUnits, isLoading])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'visible_units', value: String(selectedCount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('診察室数を更新しました', 'success')
      mutate()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">診察室設定</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-gray-900">カレンダー設定</h2>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              表示する診察室数
            </label>
            <select
              value={selectedCount}
              onChange={(e) => setSelectedCount(parseInt(e.target.value))}
              className="w-full max-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-base"
            >
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} （診察室1〜{n}）
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              カレンダーに表示する診察室の数です。予約作成時の選択肢にも反映されます。
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || selectedCount === visibleUnits}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
