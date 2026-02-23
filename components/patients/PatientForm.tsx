'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { Patient } from '@/lib/supabase/types'

type PatientFormProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  patient?: Patient | null
}

type FormData = {
  chart_number: string
  name: string
  name_kana: string
  phone: string
  email: string
  reminder_sms: boolean
  reminder_email: boolean
}

const initialFormData: FormData = {
  chart_number: '',
  name: '',
  name_kana: '',
  phone: '',
  email: '',
  reminder_sms: false,
  reminder_email: false,
}

export default function PatientForm({ isOpen, onClose, onSaved, patient }: PatientFormProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isEdit = !!patient

  useEffect(() => {
    if (patient) {
      setForm({
        chart_number: patient.chart_number || '',
        name: patient.name,
        name_kana: patient.name_kana || '',
        phone: patient.phone || '',
        email: patient.email || '',
        reminder_sms: patient.reminder_sms,
        reminder_email: patient.reminder_email,
      })
    } else {
      setForm(initialFormData)
    }
    setErrors({})
  }, [patient, isOpen])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.chart_number.trim()) newErrors.chart_number = 'カルテNoは必須です'
    if (!form.name.trim()) newErrors.name = '氏名は必須です'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit ? { id: patient!.id, ...form } : form

      const res = await fetch('/api/patients', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ chart_number: data.error })
        } else {
          showToast(data.error || 'エラーが発生しました', 'error')
        }
        return
      }

      showToast(isEdit ? '患者情報を更新しました' : '患者を登録しました', 'success')
      onSaved()
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!patient) return

    setSaving(true)
    try {
      const res = await fetch(`/api/patients?id=${patient.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }

      showToast('患者を無効にしました', 'success')
      onSaved()
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '患者情報の編集' : '患者の新規登録'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* カルテNo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              カルテNo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.chart_number}
              onChange={(e) => setForm({ ...form, chart_number: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-base ${
                errors.chart_number ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="例: 1001"
            />
            {errors.chart_number && (
              <p className="mt-1 text-sm text-red-500">{errors.chart_number}</p>
            )}
          </div>

          {/* 氏名 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-base ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="例: 田中 太郎"
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* フリガナ */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">フリガナ</label>
            <input
              type="text"
              value={form.name_kana}
              onChange={(e) => setForm({ ...form, name_kana: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: タナカ タロウ"
            />
          </div>

          {/* 電話番号 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">電話番号</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: 090-1234-5678"
            />
          </div>

          {/* メール */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">メールアドレス</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: example@email.com"
            />
          </div>

          {/* SMS通知 */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-3">
            <label className="text-sm font-medium text-gray-700">SMS通知を希望</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.reminder_sms}
              onClick={() => setForm({ ...form, reminder_sms: !form.reminder_sms })}
              className={`relative inline-flex h-7 w-12 min-w-[48px] items-center rounded-full transition-colors ${
                form.reminder_sms ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.reminder_sms ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* メール通知 */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-3">
            <label className="text-sm font-medium text-gray-700">メール通知を希望</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.reminder_email}
              onClick={() => setForm({ ...form, reminder_email: !form.reminder_email })}
              className={`relative inline-flex h-7 w-12 min-w-[48px] items-center rounded-full transition-colors ${
                form.reminder_email ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.reminder_email ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? '保存中...' : isEdit ? '更新' : '登録'}
            </Button>
          </div>

          {/* 論理削除ボタン（編集時のみ） */}
          {isEdit && (
            <div className="border-t border-gray-200 pt-4">
              <Button
                variant="danger"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
                disabled={saving}
              >
                この患者を無効にする
              </Button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="患者の無効化"
        message={`${patient?.name} さんを無効にしますか？無効にした患者は一覧に表示されなくなります。`}
        confirmLabel="無効にする"
        variant="danger"
      />
    </>
  )
}
