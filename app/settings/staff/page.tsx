'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useStaff } from '@/hooks/useStaff'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

export default function StaffSettingsPage() {
  const { staffList, mutate } = useStaff()
  const { showToast } = useToast()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [localColors, setLocalColors] = useState<Record<string, string>>({})

  function getColor(staffId: string, dbColor?: string | null): string {
    if (localColors[staffId] !== undefined) return localColors[staffId]
    return dbColor || ''
  }

  async function handleSaveColor(staffId: string, color: string) {
    setSavingId(staffId)
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staffId, color: color || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('スタッフ色を更新しました', 'success')
      // ローカル状態をクリアしてSWRを再取得
      setLocalColors(prev => {
        const next = { ...prev }
        delete next[staffId]
        return next
      })
      mutate()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSavingId(null)
    }
  }

  function handleColorChange(staffId: string, color: string) {
    setLocalColors(prev => ({ ...prev, [staffId]: color }))
  }

  function handleClearColor(staffId: string) {
    setLocalColors(prev => ({ ...prev, [staffId]: '' }))
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">スタッフ表示設定</h1>

        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>
            スタッフの追加・編集・PIN変更・無効化は{' '}
            <a
              href="https://app.oralcare-kanazawa.clinic/settings/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:text-emerald-900"
            >
              在庫管理アプリ
            </a>
            {' '}から行えます。
          </p>
        </div>

        <div className="space-y-4">
          {staffList.map((staff) => {
            const currentColor = getColor(staff.id, staff.color)
            const hasUnsaved = localColors[staff.id] !== undefined && localColors[staff.id] !== (staff.color || '')

            return (
              <div
                key={staff.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* 色プレビュー */}
                  <div
                    className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: currentColor || '#e5e7eb' }}
                  />
                  {/* スタッフ名 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-gray-900">{staff.name}</p>
                    <p className="text-xs text-gray-500">
                      {currentColor || '色未設定'}
                    </p>
                  </div>
                  {/* 保存ボタン */}
                  {hasUnsaved && (
                    <Button
                      onClick={() => handleSaveColor(staff.id, currentColor)}
                      disabled={savingId === staff.id}
                      className="flex-shrink-0"
                    >
                      {savingId === staff.id ? '保存中...' : '保存'}
                    </Button>
                  )}
                </div>

                {/* プリセットカラーパレット */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(staff.id, color)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        currentColor === color
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-200 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* カスタムカラー */}
                  <label className="relative h-8 w-8 cursor-pointer">
                    <input
                      type="color"
                      value={currentColor || '#3b82f6'}
                      onChange={(e) => handleColorChange(staff.id, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-400"
                      title="カスタム色"
                    >
                      +
                    </div>
                  </label>
                  {/* クリアボタン */}
                  {currentColor && (
                    <button
                      type="button"
                      onClick={() => handleClearColor(staff.id)}
                      className="flex h-8 items-center rounded-full border border-gray-300 px-2 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {staffList.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500">スタッフが登録されていません</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
