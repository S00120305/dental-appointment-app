'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useSettings } from '@/hooks/useSettings'

const UNIT_TYPE_OPTIONS = [
  { value: 'hygienist', label: '衛生士用' },
  { value: 'doctor', label: 'Dr用' },
]

export default function UnitsSettingsPage() {
  const { showToast } = useToast()
  const { visibleUnits, mutate, isLoading } = useSettings()
  const [selectedUnits, setSelectedUnits] = useState<number[]>([1, 2, 3, 4])
  const [displayOrder, setDisplayOrder] = useState<number[]>([1, 2, 3, 4])
  const [unitTypes, setUnitTypes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const initialized = useRef(false)

  // 診察室タイプ設定を取得
  const fetchUnitTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings?.unit_types) {
        try {
          setUnitTypes(JSON.parse(data.settings.unit_types))
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchUnitTypes() }, [fetchUnitTypes])

  useEffect(() => {
    if (!isLoading && visibleUnits.length > 0 && !initialized.current) {
      initialized.current = true
      setSelectedUnits(visibleUnits)
      setDisplayOrder(visibleUnits)
    }
  }, [visibleUnits, isLoading])

  function toggleUnit(n: number) {
    setSelectedUnits(prev => {
      if (prev.includes(n)) {
        if (prev.length <= 1) return prev
        const next = prev.filter(u => u !== n)
        setDisplayOrder(order => order.filter(u => u !== n))
        return next
      }
      const next = [...prev, n]
      setDisplayOrder(order => [...order, n])
      return next
    })
  }

  function moveUnit(idx: number, direction: 'up' | 'down') {
    setDisplayOrder(prev => {
      const arr = [...prev]
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= arr.length) return prev
      ;[arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]]
      return arr
    })
  }

  function setUnitType(unit: number, type: string) {
    setUnitTypes(prev => ({ ...prev, [String(unit)]: type }))
  }

  async function handleSave() {
    if (selectedUnits.length === 0) {
      showToast('最低1つの診察室を選択してください', 'error')
      return
    }
    setSaving(true)
    try {
      // visible_units はソート済み（チェック用）、unit_display_order は表示順
      const sortedUnits = [...selectedUnits].sort((a, b) => a - b)
      await Promise.all([
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'visible_units', value: sortedUnits.join(',') }),
        }),
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'unit_types', value: JSON.stringify(unitTypes) }),
        }),
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'unit_display_order', value: displayOrder.join(',') }),
        }),
      ])
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
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(n)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600"
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

          {/* 診察室タイプ設定 */}
          <div className="mb-6">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              診察室タイプ（Web予約の自動割当に使用）
            </label>
            <div className="space-y-2">
              {selectedUnits.map(n => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-medium text-gray-700">診察室{n}</span>
                  <select
                    value={unitTypes[String(n)] || 'doctor'}
                    onChange={e => setUnitType(n, e.target.value)}
                    className="min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base"
                  >
                    {UNIT_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              衛生士用の種別は衛生士用の診察室に、Dr用の種別はDr用の診察室に自動割当されます。
            </p>
          </div>

          {/* 表示順序設定 */}
          <div className="mb-6">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              カレンダー表示順序
            </label>
            <div className="space-y-1">
              {displayOrder.filter(n => selectedUnits.includes(n)).map((n, idx) => (
                <div key={n} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="w-24 text-sm font-medium text-gray-700">診察室{n}</span>
                  <span className="text-xs text-gray-400">
                    {unitTypes[String(n)] === 'hygienist' ? '衛生士用' : 'Dr用'}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveUnit(idx, 'up')}
                      disabled={idx === 0}
                      className="min-h-[36px] min-w-[36px] rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    >
                      {'\u25B2'}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveUnit(idx, 'down')}
                      disabled={idx === displayOrder.filter(u => selectedUnits.includes(u)).length - 1}
                      className="min-h-[36px] min-w-[36px] rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    >
                      {'\u25BC'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              カレンダーの左から右への表示順序を変更できます。
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
