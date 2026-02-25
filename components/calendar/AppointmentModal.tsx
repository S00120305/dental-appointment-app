'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StatusBadge from '@/components/calendar/StatusBadge'
import LabOrderBadge from '@/components/calendar/LabOrderBadge'
import { useToast } from '@/components/ui/Toast'
import { getNextStatus, getPrevStatus, STATUS_TEXT, STATUS_LABELS } from '@/lib/constants/appointment'
import type { AppointmentStatus, AppointmentWithRelations, BookingType, LabOrderWithLab, Patient, Staff } from '@/lib/supabase/types'

type StaffHolidayInfo = {
  holiday_type: string
  label: string | null
}

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
  defaultDuration?: number // minutes
  isHoliday?: (dateStr: string) => boolean
  getHolidayLabel?: (dateStr: string) => string | null
  getStaffHolidayMap?: (dateStr: string) => Record<string, StaffHolidayInfo>
}

type FormData = {
  patient_id: string
  unit_number: number
  staff_id: string
  date: string
  time: string
  duration_minutes: number
  appointment_type: string
  booking_type_id: string
  memo: string
  lab_order_id: string
}

const DURATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 120]

function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  let h = startH
  let m = startM
  while (h < endH || (h === endH && m <= endM)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += 10
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
  defaultDuration,
  isHoliday,
  getHolidayLabel,
  getStaffHolidayMap,
}: AppointmentModalProps) {
  const { showToast } = useToast()
  const isEdit = !!appointment

  // Settings
  const [unitList, setUnitList] = useState<number[]>([1, 2, 3, 4, 5])
  const [appointmentTypes, setAppointmentTypes] = useState<string[]>([])
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([])
  const [businessHours, setBusinessHours] = useState({ start: '09:00', end: '18:00' })
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [useCustomType, setUseCustomType] = useState(false)

  // Patient search
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Pick<Patient, 'id' | 'chart_number' | 'name' | 'name_kana'> | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const patientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lab order
  const [labOrderEnabled, setLabOrderEnabled] = useState(false)
  const [labOrders, setLabOrders] = useState<LabOrderWithLab[]>([])
  const [labOrdersLoading, setLabOrdersLoading] = useState(false)

  // Form
  const [form, setForm] = useState<FormData>({
    patient_id: '',
    unit_number: 1,
    staff_id: '',
    date: '',
    time: '09:00',
    duration_minutes: 30,
    appointment_type: '',
    booking_type_id: '',
    memo: '',
    lab_order_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Fetch settings, staff, and booking types on mount
  useEffect(() => {
    if (!isOpen) return
    fetchSettings()
    fetchStaff()
    fetchBookingTypes()
  }, [isOpen])

  // Initialize form
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setPatientQuery('')
    setPatientResults([])
    setShowPatientDropdown(false)
    setLabOrders([])

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
        booking_type_id: appointment.booking_type_id || '',
        memo: appointment.memo || '',
        lab_order_id: appointment.lab_order_id || '',
      })
      setSelectedPatient(appointment.patient)
      setLabOrderEnabled(!!appointment.lab_order_id)
      setUseCustomType(!appointment.booking_type_id)
      // 技工物紐付け済みの場合、技工物リストを取得
      if (appointment.lab_order_id && appointment.patient?.chart_number) {
        fetchLabOrders(appointment.patient.chart_number)
      }
    } else {
      const today = defaultDate || formatDateLocal(new Date())
      setForm({
        patient_id: '',
        unit_number: defaultUnitNumber || 1,
        staff_id: '',
        date: today,
        time: defaultStartTime || '09:00',
        duration_minutes: defaultDuration || 30,
        appointment_type: '',
        booking_type_id: '',
        memo: '',
        lab_order_id: '',
      })
      setSelectedPatient(null)
      setLabOrderEnabled(false)
      setUseCustomType(false)
    }
  }, [isOpen, appointment, defaultDate, defaultUnitNumber, defaultStartTime, defaultDuration])

  // Set default booking type when types are loaded
  useEffect(() => {
    if (bookingTypes.length > 0 && !form.booking_type_id && !form.appointment_type && !appointment && !useCustomType) {
      const first = bookingTypes[0]
      setForm((prev) => ({
        ...prev,
        booking_type_id: first.id,
        appointment_type: first.internal_name,
        duration_minutes: defaultDuration || first.duration_minutes,
      }))
    }
  }, [bookingTypes, form.booking_type_id, form.appointment_type, appointment, useCustomType, defaultDuration])

  // Fetch lab orders when patient changes and toggle is ON
  useEffect(() => {
    if (labOrderEnabled && selectedPatient?.chart_number) {
      fetchLabOrders(selectedPatient.chart_number)
    } else {
      setLabOrders([])
    }
  }, [labOrderEnabled, selectedPatient])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        const s = data.settings
        const { parseVisibleUnits } = await import('@/hooks/useSettings')
        const raw = s.visible_units || s.unit_count || '5'
        setUnitList(parseVisibleUnits(raw))
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

  async function fetchBookingTypes() {
    try {
      const res = await fetch('/api/booking-types')
      const data = await res.json()
      if (res.ok) setBookingTypes(data.booking_types || [])
    } catch { /* ignore */ }
  }

  async function fetchLabOrders(chartNumber: string) {
    setLabOrdersLoading(true)
    try {
      const res = await fetch(`/api/lab-orders?patient_id=${encodeURIComponent(chartNumber)}&for_appointment=true`)
      const data = await res.json()
      if (res.ok) setLabOrders(data.lab_orders || [])
    } catch { /* ignore */ }
    finally { setLabOrdersLoading(false) }
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
    setForm((prev) => ({ ...prev, patient_id: patient.id, lab_order_id: '' }))
    setPatientQuery(`${patient.chart_number} ${patient.name}`)
    setShowPatientDropdown(false)
    setPatientResults([])
  }

  function handleClearPatient() {
    setSelectedPatient(null)
    setForm((prev) => ({ ...prev, patient_id: '', lab_order_id: '' }))
    setPatientQuery('')
    setLabOrderEnabled(false)
    setLabOrders([])
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.patient_id) newErrors.patient_id = '患者を選択してください'
    if (!form.unit_number) newErrors.unit_number = '診察室を選択してください'
    if (!form.staff_id) newErrors.staff_id = '担当スタッフを選択してください'
    if (!form.date) newErrors.date = '日付を選択してください'
    if (!form.time) newErrors.time = '開始時刻を選択してください'
    if (!form.duration_minutes) newErrors.duration_minutes = '所要時間を選択してください'
    if (!form.booking_type_id && !form.appointment_type) newErrors.appointment_type = '予約種別を選択してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      // まずエラーサマリーへスクロール、なければ最初のエラーフィールドへ
      const summary = document.getElementById('error-summary')
      if (summary) {
        summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        const firstError = document.querySelector('[data-error]')
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSaving(true)
    try {
      const startTime = `${form.date}T${form.time}:00+09:00`
      const method = isEdit ? 'PUT' : 'POST'
      const baseBody = {
        patient_id: form.patient_id,
        unit_number: form.unit_number,
        staff_id: form.staff_id,
        start_time: startTime,
        duration_minutes: form.duration_minutes,
        appointment_type: form.appointment_type,
        booking_type_id: form.booking_type_id || null,
        memo: form.memo,
        lab_order_id: labOrderEnabled ? form.lab_order_id || null : null,
      }
      const body = isEdit ? { id: appointment!.id, ...baseBody } : baseBody

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
          {isEdit && appointment && onStatusChange && currentStatus !== 'cancelled' && currentStatus !== 'no_show' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!prevStatus || statusChanging}
                  onClick={() => prevStatus && handleStatusChange(prevStatus)}
                  className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ◀ 戻す
                </button>
                <StatusBadge status={currentStatus!} size="lg" />
                <button
                  type="button"
                  disabled={!nextStatus || statusChanging}
                  onClick={() => nextStatus && handleStatusChange(nextStatus)}
                  className="min-h-[44px] rounded-md px-3 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: nextStatus ? (STATUS_TEXT[nextStatus] || '#374151') : '#9ca3af',
                  }}
                >
                  {nextStatus ? `${STATUS_LABELS[nextStatus]}にする ▶` : '完了'}
                </button>
              </div>
              {/* キャンセル / 無断キャンセル ドロップダウン */}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => handleStatusChange('no_show')}
                  className="flex-1 min-h-[44px] rounded-md border border-yellow-400 bg-white px-3 text-sm font-medium text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                >
                  無断キャンセル
                </button>
              </div>
            </div>
          )}

          {/* キャンセル / 無断キャンセル済み表示 */}
          {isEdit && (currentStatus === 'cancelled' || currentStatus === 'no_show') && (
            <div className={`rounded-lg border p-3 text-center ${
              currentStatus === 'no_show' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'
            }`}>
              <StatusBadge status={currentStatus} size="lg" />
              {onStatusChange && (
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => handleStatusChange('scheduled')}
                  className="mt-2 w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  未来院に戻す
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

          {/* バリデーションエラーサマリー（sticky で常時表示） */}
          {Object.keys(errors).filter(k => k !== 'overlap').length > 0 && (
            <div
              id="error-summary"
              className="sticky top-0 z-10 cursor-pointer rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 shadow-sm"
              onClick={() => {
                const firstError = document.querySelector('[data-error]')
                firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              <p className="font-medium">入力内容に{Object.keys(errors).filter(k => k !== 'overlap').length}件のエラーがあります</p>
              <ul className="mt-1 list-disc list-inside">
                {Object.entries(errors).filter(([k]) => k !== 'overlap').map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-red-400">タップでエラー箇所へ移動</p>
            </div>
          )}

          {/* 患者検索 */}
          <div data-error={errors.patient_id ? true : undefined}>
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
                        className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 min-h-[44px]"
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
                診察室 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit_number}
                onChange={(e) => setForm({ ...form, unit_number: parseInt(e.target.value) })}
                className={`w-full rounded-md border px-3 py-2 text-base ${
                  errors.unit_number ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {unitList.map((n) => (
                  <option key={n} value={n}>
                    診察室{n}
                  </option>
                ))}
              </select>
            </div>
            <div data-error={errors.staff_id ? true : undefined}>
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
                {staffList.map((s) => {
                  const staffHolidayMap = form.date && getStaffHolidayMap ? getStaffHolidayMap(form.date) : {}
                  const isOff = !!staffHolidayMap[s.id]
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}{isOff ? ' [休み]' : ''}
                    </option>
                  )
                })}
              </select>
              {form.staff_id && form.date && getStaffHolidayMap && (() => {
                const map = getStaffHolidayMap(form.date)
                const info = map[form.staff_id]
                if (!info) return null
                const TYPE_LABELS: Record<string, string> = {
                  paid_leave: '有給', day_off: '公休', half_day_am: '午前休', half_day_pm: '午後休', other: 'その他',
                }
                return (
                  <div className="mt-1 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-700">
                    {'\u26A0'} このスタッフは{TYPE_LABELS[info.holiday_type] || '休み'}です
                  </div>
                )
              })()}
              {errors.staff_id && <p className="mt-1 text-sm text-red-500">{errors.staff_id}</p>}
            </div>
          </div>

          {/* 日付 */}
          <div data-error={errors.date ? true : undefined}>
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
            {form.date && isHoliday?.(form.date) && (
              <div className="mt-1 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-700">
                {'\u26A0'} この日は休診日です（{getHolidayLabel?.(form.date) || '休診日'}）
              </div>
            )}
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
          <div data-error={errors.appointment_type ? true : undefined}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              予約種別 <span className="text-red-500">*</span>
            </label>
            {!useCustomType ? (
              <>
                <select
                  value={form.booking_type_id}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__custom__') {
                      setUseCustomType(true)
                      setForm(prev => ({ ...prev, booking_type_id: '', appointment_type: '' }))
                      return
                    }
                    const bt = bookingTypes.find(b => b.id === val)
                    setForm(prev => ({
                      ...prev,
                      booking_type_id: val,
                      appointment_type: bt?.internal_name || '',
                      duration_minutes: bt?.duration_minutes || prev.duration_minutes,
                    }))
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-base ${
                    errors.appointment_type ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">選択してください</option>
                  {bookingTypes.map(bt => (
                    <option key={bt.id} value={bt.id}>
                      {bt.display_name}（{bt.internal_name}）
                    </option>
                  ))}
                  <option disabled>───</option>
                  <option value="__custom__">カスタム入力...</option>
                </select>
                {form.booking_type_id && (
                  <p className="mt-1 text-xs text-gray-500">
                    院内名: {bookingTypes.find(b => b.id === form.booking_type_id)?.internal_name}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.appointment_type}
                    onChange={(e) => setForm({ ...form, appointment_type: e.target.value })}
                    className={`flex-1 rounded-md border px-3 py-2 text-base ${
                      errors.appointment_type ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="種別名を入力"
                    list="appointment-types-list"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomType(false)
                      setForm(prev => ({ ...prev, appointment_type: '', booking_type_id: '' }))
                    }}
                    className="min-h-[44px] rounded-md border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    一覧に戻す
                  </button>
                </div>
                <datalist id="appointment-types-list">
                  {appointmentTypes.map(t => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            )}
            {errors.appointment_type && (
              <p className="mt-1 text-sm text-red-500">{errors.appointment_type}</p>
            )}
          </div>

          {/* 技工物セット */}
          {selectedPatient && (
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {'\uD83E\uDDB7'} 技工物セット
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLabOrderEnabled(!labOrderEnabled)
                    if (labOrderEnabled) {
                      setForm(prev => ({ ...prev, lab_order_id: '' }))
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-h-[44px] min-w-[44px] ${
                    labOrderEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      labOrderEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {labOrderEnabled && (
                <div className="mt-3">
                  {labOrdersLoading ? (
                    <p className="text-sm text-gray-400">技工物を取得中...</p>
                  ) : labOrders.length === 0 ? (
                    <p className="text-sm text-gray-500">紐付け可能な技工物がありません</p>
                  ) : (
                    <div className="space-y-2">
                      {labOrders.map((lo) => (
                        <label
                          key={lo.id}
                          className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer min-h-[44px] ${
                            form.lab_order_id === lo.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="lab_order_id"
                            value={lo.id}
                            checked={form.lab_order_id === lo.id}
                            onChange={() => setForm(prev => ({ ...prev, lab_order_id: lo.id }))}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{lo.item_type || '技工物'}</span>
                              {lo.tooth_info && (
                                <span className="text-xs text-gray-500">({lo.tooth_info})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <LabOrderBadge labOrderStatus={lo.status} size="md" />
                              {lo.lab && (
                                <span className="text-xs text-gray-400">{lo.lab.name}</span>
                              )}
                            </div>
                            {lo.due_date && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                納期: {lo.due_date}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
        onConfirm={() => handleStatusChange('cancelled')}
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
