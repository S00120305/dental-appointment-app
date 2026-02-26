'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { BookingType } from '@/lib/supabase/types'
import { BOOKING_CATEGORIES } from '@/lib/supabase/types'

const DURATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280',
]

type FormData = {
  display_name: string
  internal_name: string
  duration_minutes: number
  confirmation_mode: 'instant' | 'approval'
  is_web_bookable: boolean
  is_token_only: boolean
  description: string
  notes: string
  color: string
  category: string
  unit_type: 'hygienist' | 'doctor' | 'any'
  sort_order: number
}

const defaultForm: FormData = {
  display_name: '',
  internal_name: '',
  duration_minutes: 30,
  confirmation_mode: 'approval',
  is_web_bookable: true,
  is_token_only: false,
  description: '',
  notes: '',
  color: '#3B82F6',
  category: '',
  unit_type: 'any',
  sort_order: 0,
}

const UNIT_TYPE_LABEL: Record<string, string> = {
  hygienist: 'DH',
  doctor: 'Dr',
  any: '共通',
}

export default function BookingTypesPage() {
  const { showToast } = useToast()
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const fetchBookingTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/booking-types?include_inactive=true')
      const data = await res.json()
      if (res.ok) setBookingTypes(data.booking_types || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBookingTypes() }, [fetchBookingTypes])

  function handleAdd() {
    setEditingId(null)
    setForm({ ...defaultForm, sort_order: bookingTypes.length + 1 })
    setModalOpen(true)
  }

  function handleEdit(bt: BookingType) {
    setEditingId(bt.id)
    setForm({
      display_name: bt.display_name,
      internal_name: bt.internal_name,
      duration_minutes: bt.duration_minutes,
      confirmation_mode: bt.confirmation_mode,
      is_web_bookable: bt.is_web_bookable,
      is_token_only: bt.is_token_only,
      description: bt.description,
      notes: bt.notes,
      color: bt.color,
      category: bt.category || '',
      unit_type: bt.unit_type || 'any',
      sort_order: bt.sort_order,
    })
    setModalOpen(true)
  }

  function handleCategoryChange(categoryName: string) {
    const cat = BOOKING_CATEGORIES.find(c => c.name === categoryName)
    setForm(prev => ({
      ...prev,
      category: categoryName,
      color: cat?.color || prev.color,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim() || !form.internal_name.trim()) {
      showToast('名称は必須です', 'error')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/booking-types/${editingId}` : '/api/booking-types'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast(editingId ? '種別を更新しました' : '種別を追加しました', 'success')
      setModalOpen(false)
      fetchBookingTypes()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/booking-types/${editingId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('種別を無効化しました', 'success')
      setModalOpen(false)
      setShowDeactivateConfirm(false)
      fetchBookingTypes()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate(id: string) {
    try {
      const bt = bookingTypes.find(b => b.id === id)
      if (!bt) return
      const res = await fetch(`/api/booking-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bt, is_active: true }),
      })
      if (res.ok) {
        showToast('種別を再有効化しました', 'success')
        fetchBookingTypes()
      }
    } catch { /* ignore */ }
  }

  // Drag-and-drop state
  const dragItem = useRef<{ id: string; category: string } | null>(null)
  const dragOverItem = useRef<{ id: string; category: string } | null>(null)
  const [reordering, setReordering] = useState(false)

  async function handleDrop(category: string) {
    if (!dragItem.current || !dragOverItem.current) return
    if (dragItem.current.category !== category || dragOverItem.current.category !== category) return
    if (dragItem.current.id === dragOverItem.current.id) return

    const categoryItems = bookingTypes
      .filter(bt => bt.is_active && bt.category === category)
      .sort((a, b) => a.sort_order - b.sort_order)

    const dragIdx = categoryItems.findIndex(bt => bt.id === dragItem.current!.id)
    const overIdx = categoryItems.findIndex(bt => bt.id === dragOverItem.current!.id)
    if (dragIdx === -1 || overIdx === -1) return

    const reordered = [...categoryItems]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(overIdx, 0, moved)

    // Optimistic UI update
    const updates = reordered.map((bt, i) => ({ id: bt.id, sort_order: i + 1 }))
    setBookingTypes(prev =>
      prev.map(bt => {
        const upd = updates.find(u => u.id === bt.id)
        return upd ? { ...bt, sort_order: upd.sort_order } : bt
      })
    )

    // Save to server
    setReordering(true)
    try {
      const res = await fetch('/api/booking-types/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      if (res.ok) {
        showToast('並び順を更新しました', 'success')
      } else {
        showToast('並び順の更新に失敗しました', 'error')
        fetchBookingTypes()
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
      fetchBookingTypes()
    } finally {
      setReordering(false)
    }

    dragItem.current = null
    dragOverItem.current = null
  }

  const activeTypes = bookingTypes.filter(bt => bt.is_active)
  const inactiveTypes = bookingTypes.filter(bt => !bt.is_active)

  // カテゴリ別グルーピング
  const activeGroups = useMemo(() => {
    const groups: { category: string; color: string; items: BookingType[] }[] = []
    for (const cat of BOOKING_CATEGORIES) {
      const items = activeTypes.filter(bt => bt.category === cat.name)
      if (items.length > 0) {
        groups.push({ category: cat.name, color: cat.color, items })
      }
    }
    const uncategorized = activeTypes.filter(
      bt => !bt.category || !BOOKING_CATEGORIES.some(c => c.name === bt.category)
    )
    if (uncategorized.length > 0) {
      groups.push({ category: '未分類', color: '#9CA3AF', items: uncategorized })
    }
    return groups
  }, [activeTypes])

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">予約種別管理</h1>
          <Button onClick={handleAdd}>+ 種別を追加</Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {activeGroups.map(group => (
              <div key={group.category}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="text-sm font-semibold text-gray-600">
                    {group.category}
                    <span className="ml-1 text-xs font-normal text-gray-400">({group.items.length})</span>
                  </h3>
                </div>
                <div className="space-y-1">
                  {[...group.items].sort((a, b) => a.sort_order - b.sort_order).map(bt => (
                    <div
                      key={bt.id}
                      draggable
                      onDragStart={() => { dragItem.current = { id: bt.id, category: group.category } }}
                      onDragOver={(e) => { e.preventDefault(); dragOverItem.current = { id: bt.id, category: group.category } }}
                      onDrop={() => handleDrop(group.category)}
                      onDragEnd={() => { dragItem.current = null; dragOverItem.current = null }}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-300 select-none text-lg" title="ドラッグで並び替え">{'\u2261'}</span>
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: bt.color }}
                          />
                          <div>
                            <span className="font-medium text-gray-900">{bt.internal_name}</span>
                            {bt.internal_name !== bt.display_name && (
                              <span className="ml-2 text-sm text-gray-400">({bt.display_name})</span>
                            )}
                            <span className="ml-3 text-sm text-gray-500">{bt.duration_minutes}分</span>
                            {bt.unit_type && bt.unit_type !== 'any' && (
                              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                bt.unit_type === 'hygienist' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {UNIT_TYPE_LABEL[bt.unit_type]}
                              </span>
                            )}
                            {bt.is_web_bookable && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                Web予約
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEdit(bt)}
                          className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          編集
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {inactiveTypes.length > 0 && (
              <>
                <h2 className="mt-6 text-sm font-medium text-gray-500">無効な種別</h2>
                {inactiveTypes.map(bt => (
                  <div
                    key={bt.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: bt.color }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-500">{bt.display_name}</h3>
                          <p className="mt-0.5 text-sm text-gray-400">
                            院内名: {bt.internal_name} | {bt.duration_minutes}分
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivate(bt.id)}
                        className="min-h-[44px] rounded-md border border-gray-300 px-3 text-sm text-gray-500 hover:bg-white"
                      >
                        再有効化
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '予約種別の編集' : '予約種別の追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">カテゴリ</label>
            <select
              value={form.category}
              onChange={e => handleCategoryChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
            >
              <option value="">選択してください</option>
              {BOOKING_CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              患者向け名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: 定期検診・クリーニング"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              院内種別名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.internal_name}
              onChange={e => setForm({ ...form, internal_name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: P処"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              デフォルト所要時間 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.duration_minutes}
              onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
            >
              {DURATION_OPTIONS.map(d => (
                <option key={d} value={d}>{d}分</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              確定方式 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="confirmation_mode"
                  value="instant"
                  checked={form.confirmation_mode === 'instant'}
                  onChange={() => setForm({ ...form, confirmation_mode: 'instant' })}
                />
                <span className="text-sm">即時確定</span>
              </label>
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="confirmation_mode"
                  value="approval"
                  checked={form.confirmation_mode === 'approval'}
                  onChange={() => setForm({ ...form, confirmation_mode: 'approval' })}
                />
                <span className="text-sm">承認制</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">診察室タイプ</label>
            <select
              value={form.unit_type}
              onChange={e => setForm({ ...form, unit_type: e.target.value as 'hygienist' | 'doctor' | 'any' })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
            >
              <option value="hygienist">衛生士用 (hygienist)</option>
              <option value="doctor">Dr用 (doctor)</option>
              <option value="any">どちらも (any)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Web予約時に自動割当される診察室を制限します</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Web予約</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={form.is_web_bookable}
                  onChange={e => setForm({
                    ...form,
                    is_web_bookable: e.target.checked,
                    is_token_only: e.target.checked ? false : form.is_token_only,
                  })}
                  className="h-4 w-4"
                />
                <span className="text-sm">Web予約で選択可能</span>
              </label>
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={form.is_token_only}
                  onChange={e => setForm({
                    ...form,
                    is_token_only: e.target.checked,
                    is_web_bookable: e.target.checked ? false : form.is_web_bookable,
                  })}
                  className="h-4 w-4"
                />
                <span className="text-sm">トークン予約専用</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">カレンダー表示色</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full border-2 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    form.color === c ? 'border-gray-900' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {form.color === c && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">患者向け説明文</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="Web予約ページに表示する説明"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">院内向け備考</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="スタッフ向けメモ"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">表示順</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-base"
              min={0}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>

          {editingId && (
            <div className="border-t border-gray-200 pt-4">
              <p className="mb-2 text-xs text-gray-500">危険な操作</p>
              <Button
                variant="danger"
                type="button"
                onClick={() => setShowDeactivateConfirm(true)}
                className="w-full"
                disabled={saving}
              >
                この種別を無効化する
              </Button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={handleDeactivate}
        title="予約種別の無効化"
        message="この種別を無効化しますか？既存の予約には影響しません。"
        confirmLabel="無効化する"
        variant="danger"
      />
    </AppLayout>
  )
}
