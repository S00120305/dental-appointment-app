'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { cleanPhone } from '@/lib/utils/phone'
import type { Patient, LinePendingLink, PreferredNotification } from '@/lib/supabase/types'

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
  gender: string
  date_of_birth: string
  postal_code: string
  address: string
  preferred_notification: PreferredNotification
  is_vip: boolean
  caution_level: number
  is_infection_alert: boolean
}

const initialFormData: FormData = {
  chart_number: '',
  name: '',
  name_kana: '',
  phone: '',
  email: '',
  gender: '',
  date_of_birth: '',
  postal_code: '',
  address: '',
  preferred_notification: 'line',
  is_vip: false,
  caution_level: 0,
  is_infection_alert: false,
}

export default function PatientForm({ isOpen, onClose, onSaved, patient }: PatientFormProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // LINE紐付け
  const [showLineLinkModal, setShowLineLinkModal] = useState(false)
  const [pendingLinks, setPendingLinks] = useState<LinePendingLink[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState<string>('')
  const [linkingLine, setLinkingLine] = useState(false)

  const isEdit = !!patient

  useEffect(() => {
    if (patient) {
      setForm({
        chart_number: patient.chart_number || '',
        name: patient.name,
        name_kana: patient.name_kana || '',
        phone: patient.phone || '',
        email: patient.email || '',
        gender: patient.gender || '',
        date_of_birth: patient.date_of_birth || '',
        postal_code: patient.postal_code || '',
        address: patient.address || '',
        preferred_notification: patient.preferred_notification || 'line',
        is_vip: patient.is_vip ?? false,
        caution_level: patient.caution_level ?? 0,
        is_infection_alert: patient.is_infection_alert ?? false,
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
      const cleanedForm = { ...form, phone: form.phone ? cleanPhone(form.phone) : '' }
      const body = isEdit ? { id: patient!.id, ...cleanedForm } : cleanedForm

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

  // LINE紐付けモーダルを開く
  async function openLineLinkModal() {
    try {
      const res = await fetch('/api/line/pending')
      const data = await res.json()
      setPendingLinks(data.pending_links || [])
      setSelectedLinkId('')
      setShowLineLinkModal(true)
    } catch {
      showToast('LINE情報の取得に失敗しました', 'error')
    }
  }

  // LINE紐付け実行
  async function handleLineLink() {
    if (!patient || !selectedLinkId) return

    setLinkingLine(true)
    try {
      const res = await fetch('/api/line/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          line_pending_link_id: selectedLinkId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || '紐付けに失敗しました', 'error')
        return
      }

      showToast('LINE連携が完了しました', 'success')
      setShowLineLinkModal(false)
      setForm({ ...form, preferred_notification: 'line' })
      onSaved()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setLinkingLine(false)
    }
  }

  // LINE連携解除
  async function handleLineUnlink() {
    if (!patient) return

    setSaving(true)
    try {
      const res = await fetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: patient.id,
          chart_number: form.chart_number,
          name: form.name,
          line_user_id: null,
          preferred_notification: form.email ? 'email' : 'none',
        }),
      })

      if (res.ok) {
        showToast('LINE連携を解除しました', 'success')
        setForm({ ...form, preferred_notification: form.email ? 'email' : 'none' })
        onSaved()
      }
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasLineLinked = !!patient?.line_user_id

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

          {/* 性別 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">性別</label>
            <div className="flex gap-2">
              {[
                { value: '', label: '未設定' },
                { value: '男性', label: '男性' },
                { value: '女性', label: '女性' },
                { value: 'その他', label: 'その他' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: opt.value })}
                  className={`flex-1 min-h-[44px] rounded-md border-2 text-sm font-medium transition-colors ${
                    form.gender === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 生年月日 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">生年月日</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
            />
          </div>

          {/* 郵便番号 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">郵便番号</label>
            <input
              type="text"
              value={form.postal_code}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="000-0000"
            />
          </div>

          {/* 住所 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">住所</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="例: 石川県金沢市..."
            />
          </div>

          {/* 通知設定 */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">通知設定</h3>

            {/* 通知方法 */}
            <div>
              <span className="mb-1.5 block text-sm text-gray-600">通知方法</span>
              <div className="flex gap-1.5">
                {([
                  {
                    value: 'line' as const,
                    label: 'LINE',
                    sublabel: '推奨',
                    disabled: isEdit && !hasLineLinked,
                  },
                  {
                    value: 'email' as const,
                    label: 'メール',
                    sublabel: null,
                    disabled: !form.email,
                  },
                  {
                    value: 'none' as const,
                    label: '通知なし',
                    sublabel: null,
                    disabled: false,
                  },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => setForm({ ...form, preferred_notification: opt.value })}
                    className={`flex-1 min-h-[44px] rounded-md border-2 text-sm font-medium transition-colors ${
                      form.preferred_notification === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200 ring-offset-1'
                        : opt.disabled
                          ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                    {opt.sublabel && (
                      <span className="block text-[10px] font-normal opacity-70">{opt.sublabel}</span>
                    )}
                  </button>
                ))}
              </div>
              {isEdit && !hasLineLinked && form.preferred_notification === 'line' && (
                <p className="mt-1 text-xs text-amber-600">LINE未連携のため、メールにフォールバックします</p>
              )}
              {form.preferred_notification === 'email' && !form.email && (
                <p className="mt-1 text-xs text-amber-600">メールアドレスを入力してください</p>
              )}
            </div>

            {/* LINE連携ステータス（編集時のみ） */}
            {isEdit && (
              <div className="rounded-md bg-gray-50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">LINE連携</span>
                  {hasLineLinked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600">連携済み</span>
                      <button
                        type="button"
                        onClick={handleLineUnlink}
                        className="text-xs text-red-500 underline hover:text-red-700"
                      >
                        解除
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openLineLinkModal}
                      className="min-h-[36px] rounded-md bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700"
                    >
                      LINEアカウントを紐付ける
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* 患者タグ */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">患者タグ</h3>

            {/* VIP */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{'\u2B50'} VIP</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_vip}
                onClick={() => setForm({ ...form, is_vip: !form.is_vip })}
                className={`relative inline-flex h-7 w-12 min-w-[48px] items-center rounded-full transition-colors ${
                  form.is_vip ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.is_vip ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 注意レベル */}
            <div>
              <span className="mb-1.5 block text-sm text-gray-700">注意レベル</span>
              <div className="flex gap-1.5">
                {([
                  { value: 0, label: 'なし', color: 'border-gray-300 text-gray-600' },
                  { value: 1, label: '\u26A0 \u2460', color: 'border-orange-400 text-orange-600' },
                  { value: 2, label: '\u26A0 \u2461', color: 'border-red-400 text-red-600' },
                  { value: 3, label: '\u26A0 \u2462', color: 'border-red-600 text-red-700' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, caution_level: opt.value })}
                    className={`flex-1 min-h-[44px] rounded-md border-2 text-sm font-medium transition-colors ${
                      form.caution_level === opt.value
                        ? `${opt.color} bg-opacity-10 ring-2 ring-offset-1 ${
                            opt.value === 0 ? 'ring-gray-400 bg-gray-50' :
                            opt.value === 1 ? 'ring-orange-400 bg-orange-50' :
                            opt.value === 2 ? 'ring-red-400 bg-red-50' :
                            'ring-red-600 bg-red-50'
                          }`
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 感染注意 */}
            <div className={`flex items-center justify-between rounded-md px-2 py-1 ${
              form.is_infection_alert ? 'bg-purple-50' : ''
            }`}>
              <span className="text-sm text-gray-700">
                <span className={form.is_infection_alert ? 'text-purple-600 font-medium' : ''}>
                  {'\u266A'} 感染注意
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_infection_alert}
                onClick={() => setForm({ ...form, is_infection_alert: !form.is_infection_alert })}
                className={`relative inline-flex h-7 w-12 min-w-[48px] items-center rounded-full transition-colors ${
                  form.is_infection_alert ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.is_infection_alert ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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

      {/* LINE紐付けモーダル */}
      <Modal
        isOpen={showLineLinkModal}
        onClose={() => setShowLineLinkModal(false)}
        title="LINEアカウントの紐付け"
      >
        <div className="space-y-4">
          {pendingLinks.length === 0 ? (
            <div className="rounded-md bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">
                未紐付けのLINEアカウントはありません。
              </p>
              <p className="mt-1 text-xs text-gray-400">
                患者さんに医院のLINE公式アカウントを友だち追加してもらってください。
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                友だち追加済み（未紐付け）のLINEアカウントを選択してください:
              </p>
              <div className="space-y-2">
                {pendingLinks.map((link) => (
                  <label
                    key={link.id}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border-2 p-3 transition-colors ${
                      selectedLinkId === link.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="lineLink"
                      value={link.id}
                      checked={selectedLinkId === link.id}
                      onChange={() => setSelectedLinkId(link.id)}
                      className="h-4 w-4 text-green-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {link.line_display_name || '(名前未取得)'}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {new Date(link.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}追加
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowLineLinkModal(false)}
                  className="flex-1"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  onClick={handleLineLink}
                  disabled={!selectedLinkId || linkingLine}
                  className="flex-1"
                >
                  {linkingLine ? '紐付け中...' : '紐付ける'}
                </Button>
              </div>
            </>
          )}
        </div>
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
