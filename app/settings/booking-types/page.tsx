'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { BookingType } from '@/lib/supabase/types'

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120]

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
  sort_order: 0,
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
      sort_order: bt.sort_order,
    })
    setModalOpen(true)
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

  const activeTypes = bookingTypes.filter(bt => bt.is_active)
  const inactiveTypes = bookingTypes.filter(bt => !bt.is_active)

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
          <div className="space-y-2">
            {activeTypes.map(bt => (
              <div
                key={bt.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: bt.color }}
                    />
                    <div>
                      <h3 className="font-medium text-gray-900">{bt.display_name}</h3>
                      <p className="mt-0.5 text-sm text-gray-500">
                        院内名: {bt.internal_name} | {bt.duration_minutes}分 |{' '}
                        {bt.confirmation_mode === 'instant' ? '即時確定' : '承認制'} |{' '}
                        {bt.is_token_only
                          ? 'トークン専用'
                          : bt.is_web_bookable
                            ? 'Web予約 ○'
                            : '院内のみ'}
                      </p>
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
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
