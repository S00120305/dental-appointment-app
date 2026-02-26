'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { AppointmentTag } from '@/lib/supabase/types'

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#D97706',
  '#7C3AED', '#6B7280',
]

const PRESET_ICONS = ['♿', '👶', '💉', '⚠️', '⭐', '🔔', '❗', '🩺', '🦷', '💊']

type FormData = {
  name: string
  icon: string
  color: string
  sort_order: number
}

const defaultForm: FormData = {
  name: '',
  icon: '',
  color: '#3B82F6',
  sort_order: 0,
}

export default function AppointmentTagsPage() {
  const { showToast } = useToast()
  const [tags, setTags] = useState<AppointmentTag[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/appointment-tags?include_inactive=true')
      const data = await res.json()
      if (res.ok) setTags(data.appointment_tags || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTags() }, [fetchTags])

  function handleAdd() {
    setEditingId(null)
    setForm({ ...defaultForm, sort_order: tags.length + 1 })
    setModalOpen(true)
  }

  function handleEdit(tag: AppointmentTag) {
    setEditingId(tag.id)
    setForm({
      name: tag.name,
      icon: tag.icon || '',
      color: tag.color || '#3B82F6',
      sort_order: tag.sort_order,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('タグ名は必須です', 'error')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/appointment-tags/${editingId}` : '/api/appointment-tags'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? { ...form, is_active: true }
        : form
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast(editingId ? 'タグを更新しました' : 'タグを追加しました', 'success')
      setModalOpen(false)
      fetchTags()
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
      const res = await fetch(`/api/appointment-tags/${editingId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('タグを無効化しました', 'success')
      setModalOpen(false)
      setShowDeactivateConfirm(false)
      fetchTags()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate(id: string) {
    try {
      const tag = tags.find(t => t.id === id)
      if (!tag) return
      const res = await fetch(`/api/appointment-tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tag.name, icon: tag.icon, color: tag.color, sort_order: tag.sort_order, is_active: true }),
      })
      if (res.ok) {
        showToast('タグを再有効化しました', 'success')
        fetchTags()
      }
    } catch { /* ignore */ }
  }

  const activeTags = tags.filter(t => t.is_active)
  const inactiveTags = tags.filter(t => !t.is_active)

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">注意事項タグ管理</h1>
          <Button onClick={handleAdd}>+ タグを追加</Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {activeTags.length === 0 && (
              <p className="text-sm text-gray-500">タグがまだ登録されていません</p>
            )}
            {activeTags.map(tag => (
              <div
                key={tag.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {tag.color && (
                      <span
                        className="h-4 w-4 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      {tag.icon && <span className="text-lg">{tag.icon}</span>}
                      <span className="font-medium text-gray-900">{tag.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(tag)}
                    className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    編集
                  </button>
                </div>
              </div>
            ))}

            {inactiveTags.length > 0 && (
              <>
                <h2 className="mt-6 text-sm font-medium text-gray-500">無効なタグ</h2>
                {inactiveTags.map(tag => (
                  <div
                    key={tag.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {tag.color && (
                          <span
                            className="h-4 w-4 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          {tag.icon && <span className="text-lg">{tag.icon}</span>}
                          <span className="font-medium text-gray-500">{tag.name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivate(tag.id)}
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
        title={editingId ? '注意事項タグの編集' : '注意事項タグの追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              タグ名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: 車いす"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">アイコン</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={`flex h-10 w-10 items-center justify-center rounded-md border text-lg min-h-[44px] min-w-[44px] ${
                    form.icon === ic ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="任意の絵文字を入力"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">色</label>
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
                このタグを無効化する
              </Button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={handleDeactivate}
        title="タグの無効化"
        message="このタグを無効化しますか？既存の予約との紐付けは維持されます。"
        confirmLabel="無効化する"
        variant="danger"
      />
    </AppLayout>
  )
}
