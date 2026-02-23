'use client'

import { useState, useEffect, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useSettings } from '@/hooks/useSettings'

export default function UnitsSettingsPage() {
  const { showToast } = useToast()
  const { visibleUnits, mutate, isLoading } = useSettings()
  const [selectedUnits, setSelectedUnits] = useState<number[]>([1, 2, 3, 4])
  const [saving, setSaving] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!isLoading && visibleUnits.length > 0 && !initialized.current) {
      initialized.current = true
      setSelectedUnits(visibleUnits)
    }
  }, [visibleUnits, isLoading])

  function toggleUnit(n: number) {
    setSelectedUnits(prev => {
      if (prev.includes(n)) {
        // 最低1つは必要
        if (prev.length <= 1) return prev
        return prev.filter(u => u !== n).sort((a, b) => a - b)
      }
      return [...prev, n].sort((a, b) => a - b)
    })
  }

  const hasChanged = JSON.stringify(selectedUnits) !== JSON.stringify(visibleUnits)

  async function handleSave() {
    if (selectedUnits.length === 0) {
      showToast('最低1つの診察室を選択してください', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'visible_units', value: selectedUnits.join(',') }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('診察室設定を更新しました', 'success')
      initialized.current = false
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
            <label className="mb-3 block text-sm font-medium text-gray-700">
              表示する診察室
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
                const checked = selectedUnits.includes(n)
                return (
                  <label
                    key={n}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(n)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    診察室{n}
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              チェックした診察室がカレンダー・予約作成の選択肢に反映されます。最低1つは選択してください。
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !hasChanged}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
