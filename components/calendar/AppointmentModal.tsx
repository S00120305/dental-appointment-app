'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StatusBadge from '@/components/calendar/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { getNextStatus, getPrevStatus, STATUS_BG, STATUS_TEXT } from '@/lib/constants/appointment'
import type { AppointmentStatus, AppointmentWithRelations, Patient, Staff } from '@/lib/supabase/types'

type AppointmentModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: (appointment?: AppointmentWithRelations) => void
  onDeleted?: (id: string) => void
  onStatusChange?: (id: string, newStatus: AppointmentStatus) => Promise<void>
  appointment?: AppointmentWithRelations | null
  defaultDate?: string // YYYY-MM-DD
  defaultUnitNumber?: number
  defaultStartTime?: string // HH:mm
}

type FormData = {
  patient_id: string
  unit_number: number
  staff_id: string
  date: string
  time: string
  duration_minutes: number
  appointment_type: string
  memo: string
}

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120]

function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  let h = startH
  let m = startM
  while (h < endH || (h === endH && m <= endM)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += 5
    if (m >= 60) {
      h++
      m = 0
    }
  }
  return slots
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  onStatusChange,
  appointment,
  defaultDate,
  defaultUnitNumber,
  defaultStartTime,
}: AppointmentModalProps) {
  const { showToast } = useToast()
  const isEdit = !!appointment

  // Settings
  const [unitCount, setUnitCount] = useState(5)
  const [appointmentTypes, setAppointmentTypes] = useState<string[]>([])
  const [businessHours, setBusinessHours] = useState({ start: '09:00', end: '18:00' })
  const [staffList, setStaffList] = useState<Staff[]>([])

  // Patient search
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Pick<Patient, 'id' | 'chart_number' | 'name' | 'name_kana'> | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const patientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form
  const [form, setForm] = useState<FormData>({
    patient_id: '',
    unit_number: 1,
    staff_id: '',
    date: '',
    time: '09:00',
    duration_minutes: 30,
    appointment_type: '',
    memo: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Fetch settings and staff on mount
  useEffect(() => {
    if (!isOpen) return
    fetchSettings()
    fetchStaff()
  }, [isOpen])

  // Initialize form
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setPatientQuery('')
    setPatientResults([])
    setShowPatientDropdown(false)

    if (appointment) {
      const startDate = new Date(appointment.start_time)
      setForm({
        patient_id: appointment.patient_id,
        unit_number: appointment.unit_number,
        staff_id: appointment.staff_id,
        date: formatDateLocal(startDate),
        time: formatTimeLocal(startDate),
        duration_minutes: appointment.duration_minutes,
        appointment_type: appointment.appointment_type,
        memo: appointment.memo || '',
      })
      setSelectedPatient(appointment.patient)
    } else {
      const today = defaultDate || formatDateLocal(new Date())
      setForm({
        patient_id: '',
        unit_number: defaultUnitNumber || 1,
        staff_id: '',
        date: today,
        time: defaultStartTime || '09:00',
        duration_minutes: 30,
        appointment_type: '',
        memo: '',
      })
      setSelectedPatient(null)
    }
  }, [isOpen, appointment, defaultDate, defaultUnitNumber, defaultStartTime])

  // Set default appointment type when types are loaded
  useEffect(() => {
    if (appointmentTypes.length > 0 && !form.appointment_type && !appointment) {
      setForm((prev) => ({ ...prev, appointment_type: appointmentTypes[0] }))
    }
  }, [appointmentTypes, form.appointment_type, appointment])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        const s = data.settings
        if (s.unit_count) setUnitCount(parseInt(s.unit_count))
        if (s.appointment_types) {
          try { setAppointmentTypes(JSON.parse(s.appointment_types)) } catch { /* ignore */ }
        }
        if (s.business_hours) {
          try {
            const bh = JSON.parse(s.business_hours)
            setBusinessHours({ start: bh.start || '09:00', end: bh.end || '18:00' })
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  async function fetchStaff() {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok) setStaffList(data.users || [])
    } catch { /* ignore */ }
  }

  // Patient search with debounce
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPatientResults([])
      return
    }
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok) setPatientResults(data.patients || [])
    } catch { /* ignore */ }
  }, [])

  function handlePatientQueryChange(value: string) {
    setPatientQuery(value)
    setShowPatientDropdown(true)
    if (patientDebounceRef.current) clearTimeout(patientDebounceRef.current)
    patientDebounceRef.current = setTimeout(() => searchPatients(value), 300)
  }

  function handleSelectPatient(patient: Patient) {
    setSelectedPatient(patient)
    setForm((prev) => ({ ...prev, patient_id: patient.id }))
    setPatientQuery(`${patient.chart_number} ${patient.name}`)
    setShowPatientDropdown(false)
    setPatientResults([])
  }

  function handleClearPatient() {
    setSelectedPatient(null)
    setForm((prev) => ({ ...prev, patient_id: '' }))
    setPatientQuery('')
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.patient_id) newErrors.patient_id = '患者を選択してください'
    if (!form.unit_number) newErrors.unit_number = 'ユニットを選択してください'
    if (!form.staff_id) newErrors.staff_id = '担当スタッフを選択してください'
    if (!form.date) newErrors.date = '日付を選択してください'
    if (!form.time) newErrors.time = '開始時刻を選択してください'
    if (!form.duration_minutes) newErrors.duration_minutes = '所要時間を選択してください'
    if (!form.appointment_type) newErrors.appointment_type = '予約種別を選択してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const startTime = `${form.date}T${form.time}:00+09:00`
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit
        ? {
            id: appointment!.id,
            patient_id: form.patient_id,
            unit_number: form.unit_number,
            staff_id: form.staff_id,
            start_time: startTime,
            duration_minutes: form.duration_minutes,
            appointment_type: form.appointment_type,
            memo: form.memo,
          }
        : {
            patient_id: form.patient_id,
            unit_number: form.unit_number,
            staff_id: form.staff_id,
            start_time: startTime,
            duration_minutes: form.duration_minutes,
            appointment_type: form.appointment_type,
            memo: form.memo,
          }

      const res = await fetch('/api/appointments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ overlap: data.error })
        } else {
          showToast(data.error || 'エラーが発生しました', 'error')
        }
        return
      }

      showToast(isEdit ? '予約を更新しました' : '予約を作成しました', 'success')
      onSaved(data.appointment)
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!appointment) return
    setSaving(true)
    try {
      const res = await fetch(`/api/appointments?id=${appointment.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('予約を削除しました', 'success')
      onDeleted?.(appointment.id)
      onSaved()
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  // ステータス変更ハンドラ
  async function handleStatusChange(newStatus: AppointmentStatus) {
    if (!appointment || !onStatusChange) return
    setStatusChanging(true)
    try {
      await onStatusChange(appointment.id, newStatus)
      onClose()
    } catch {
      // エラーは useAppointments 側で toast 表示済み
    } finally {
      setStatusChanging(false)
      setShowCancelConfirm(false)
    }
  }

  const timeSlots = generateTimeSlots(businessHours.start, businessHours.end)

  // ステータス遷移ボタンの情報
  const currentStatus = appointment?.status as AppointmentStatus | undefined
  const nextStatus = currentStatus ? getNextStatus(currentStatus) : null
  const prevStatus = currentStatus ? getPrevStatus(currentStatus) : null

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '予約の編集' : '新規予約'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* ステータス操作セクション（編集モード時のみ） */}
          {isEdit && appointment && onStatusChange && currentStatus !== 'キャンセル' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                {/* 戻すボタン */}
                <button
                  type="button"
                  disabled={!prevStatus || statusChanging}
                  onClick={() => prevStatus && handleStatusChange(prevStatus)}
                  className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ◀ 戻す
                </button>

                {/* 現在のステータス */}
                <StatusBadge status={currentStatus!} size="lg" />

                {/* 進めるボタン */}
                <button
                  type="button"
                  disabled={!nextStatus || statusChanging}
                  onClick={() => nextStatus && handleStatusChange(nextStatus)}
                  className="min-h-[44px] rounded-md px-3 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: nextStatus ? (STATUS_TEXT[nextStatus] || '#374151') : '#9ca3af',
                  }}
                >
                  {nextStatus ? `${nextStatus}にする ▶` : '完了'}
                </button>
              </div>

              {/* キャンセルにするボタン（予約済みの時のみ） */}
              {currentStatus === '予約済み' && (
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => setShowCancelConfirm(true)}
                  className="mt-2 w-full min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  キャンセルにする
                </button>
              )}
            </div>
          )}

          {/* キャンセル済み表示 */}
          {isEdit && currentStatus === 'キャンセル' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <StatusBadge status="キャンセル" size="lg" />
              {onStatusChange && (
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => handleStatusChange('予約済み')}
                  className="mt-2 w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  予約済みに戻す
                </button>
              )}
            </div>
          )}

          {/* 重複エラー */}
          {errors.overlap && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {errors.overlap}
            </div>
          )}

          {/* 患者検索 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              患者 <span className="text-red-500">*</span>
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <span className="text-base">
                  <span className="mr-2 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    {selectedPatient.chart_number}
                  </span>
                  {selectedPatient.name}
                  {selectedPatient.name_kana && (
                    <span className="ml-2 text-sm text-gray-500">{selectedPatient.name_kana}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleClearPatient}
                  className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => handlePatientQueryChange(e.target.value)}
                  onFocus={() => patientQuery && setShowPatientDropdown(true)}
                  className={`w-full rounded-md border px-3 py-2 text-base ${
                    errors.patient_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="カルテNo / 氏名 / フリガナで検索"
                />
                {showPatientDropdown && patientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPatient(p)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 min-h-[44px]"
                      >
                        <span className="mr-2 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                          {p.chart_number}
                        </span>
                        {p.name}
                        {p.name_kana && <span className="ml-2 text-gray-500">{p.name_kana}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.patient_id && <p className="mt-1 text-sm text-red-500">{errors.patient_id}</p>}
          </div>

          {/* ユニット + 担当スタッフ（横並び） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ユニット <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit_number}
                onChange={(e) => setForm({ ...form, unit_number: parseInt(e.target.value) })}
                className={`w-full rounded-md border px-3 py-2 text-base ${
                  errors.unit_number ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {Array.from({ length: unitCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    ユニット {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                担当スタッフ <span className="text-red-500">*</span>
              </label>
              <select
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 text-base ${
                  errors.staff_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">選択してください</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.staff_id && <p className="mt-1 text-sm text-red-500">{errors.staff_id}</p>}
            </div>
          </div>

          {/* 日付 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-base ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="mt-1 text-sm text-red-500">{errors.date}</p>}
          </div>

          {/* 開始時刻 + 所要時間（横並び） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                開始時刻 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className={`w-full rounded-md border px-3 py-2 text-base ${
                  errors.time ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {timeSlots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                所要時間 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
                className={`w-full rounded-md border px-3 py-2 text-base ${
                  errors.duration_minutes ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}分
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 予約種別 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              予約種別 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.appointment_type}
              onChange={(e) => setForm({ ...form, appointment_type: e.target.value })}
              className={`w-full rounded-md border px-3 py-2 text-base ${
                errors.appointment_type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">選択してください</option>
              {appointmentTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.appointment_type && (
              <p className="mt-1 text-sm text-red-500">{errors.appointment_type}</p>
            )}
          </div>

          {/* 備考 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">備考</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              placeholder="任意のメモ"
            />
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? '保存中...' : isEdit ? '更新' : '予約を作成'}
            </Button>
          </div>

          {/* 削除ボタン（編集時のみ） */}
          {isEdit && (
            <div className="border-t border-gray-200 pt-4">
              <Button
                variant="danger"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
                disabled={saving}
              >
                この予約を削除する
              </Button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="予約の削除"
        message="この予約を削除しますか？この操作は元に戻せません。"
        confirmLabel="削除する"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => handleStatusChange('キャンセル')}
        title="予約のキャンセル"
        message="この予約をキャンセルしますか？"
        confirmLabel="キャンセルにする"
        variant="danger"
      />
    </>
  )
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeLocal(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
