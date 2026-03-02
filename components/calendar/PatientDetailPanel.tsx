'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TokenCreateModal from './TokenCreateModal'
import StatusBadge from './StatusBadge'
import LabOrderBadge from './LabOrderBadge'
import { getPatientTagIcons } from '@/lib/constants/patient-tags'
import { formatPatientName, formatPatientNameKana } from '@/lib/utils/patient-name'
import { getNextStatus, getPrevStatus, STATUS_TEXT, STATUS_LABELS } from '@/lib/constants/appointment'
import type { AppointmentStatus, AppointmentWithRelations, LabOrderStatus } from '@/lib/supabase/types'

type PatientInfo = {
  id: string
  chart_number: string
  last_name: string
  first_name: string
  last_name_kana: string | null
  first_name_kana: string | null
  phone: string | null
  email: string | null
  birth_date: string | null
  memo: string
  is_vip: boolean
  caution_level: number
  is_infection_alert: boolean
}

type PatientStats = {
  lastVisitDate: string | null
  thisMonthVisits: number
  totalAppointments: number
  cancelCount: number
  noShowCount: number
  cancelRate: number
  noShowRate: number
}

type AppointmentListItem = {
  id: string
  start_time: string
  duration_minutes: number
  appointment_type: string
  status: string
  memo: string | null
  staff: { id: string; name: string } | null
  lab_order?: {
    id: string
    status: LabOrderStatus
    item_type: string | null
    tooth_info: string | null
    due_date: string | null
    set_date: string | null
    lab?: { id: string; name: string } | null
  } | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  appointment: AppointmentWithRelations
  onStatusChange: (id: string, newStatus: AppointmentStatus) => Promise<void>
  onEditClick: () => void
  onNewAppointment: (patientId: string, patientName: string, lastStaffId?: string) => void
  onCalendarSelect: (patientId: string, patientName: string, lastStaffId?: string) => void
  onEditSlotSearch: (appointmentId: string, patientId: string, patientName: string, lastStaffId?: string) => void
  onEditCalendarSelect: (appointmentId: string, patientId: string, patientName: string, lastStaffId?: string) => void
  onJumpToDate: (date: string) => void
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const STATUS_SHORT: Record<string, string> = {
  completed: '済',
  cancelled: 'キャ',
  no_show: '無断',
  checked_in: '受付',
}

export default function PatientDetailPanel({
  isOpen,
  onClose,
  appointment,
  onStatusChange,
  onEditClick,
  onNewAppointment,
  onCalendarSelect,
  onEditSlotSearch,
  onEditCalendarSelect,
  onJumpToDate,
}: Props) {
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [stats, setStats] = useState<PatientStats | null>(null)
  const [futureAppointments, setFutureAppointments] = useState<AppointmentListItem[]>([])
  const [pastAppointments, setPastAppointments] = useState<AppointmentListItem[]>([])
  const [hasMorePast, setHasMorePast] = useState(false)
  const [pastOffset, setPastOffset] = useState(0)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)

  // Memo editing
  const [patientMemo, setPatientMemo] = useState('')
  const [patientMemoEditing, setPatientMemoEditing] = useState(false)
  const [patientMemoSaving, setPatientMemoSaving] = useState(false)
  const [apptMemo, setApptMemo] = useState('')
  const [apptMemoEditing, setApptMemoEditing] = useState(false)
  const [apptMemoSaving, setApptMemoSaving] = useState(false)

  const [statusChanging, setStatusChanging] = useState(false)
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [lastStaffIdForToken, setLastStaffIdForToken] = useState<string | undefined>(undefined)
  const [openMenu, setOpenMenu] = useState<'next' | 'edit' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const patientId = appointment.patient_id

  // Fetch patient detail
  const fetchDetail = useCallback(async () => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/detail`)
      const data = await res.json()
      if (res.ok) {
        setPatient(data.patient)
        setStats(data.stats)
        setPatientMemo(data.patient?.memo || '')
      }
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }, [patientId])

  // Fetch appointment list
  const fetchAppointments = useCallback(async (offset = 0) => {
    setLoadingAppointments(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/appointments?past_limit=5&past_offset=${offset}`)
      const data = await res.json()
      if (res.ok) {
        setFutureAppointments(data.future || [])
        if (offset === 0) {
          setPastAppointments(data.past || [])
        } else {
          setPastAppointments(prev => [...prev, ...(data.past || [])])
        }
        setHasMorePast(data.hasMorePast || false)
        setPastOffset(offset + 5)
      }
    } catch { /* ignore */ }
    finally { setLoadingAppointments(false) }
  }, [patientId])

  useEffect(() => {
    if (isOpen && patientId) {
      fetchDetail()
      fetchAppointments(0)
      setPastOffset(0)
      setApptMemo(appointment.memo || '')
      setPatientMemoEditing(false)
      setApptMemoEditing(false)
    }
  }, [isOpen, patientId, fetchDetail, fetchAppointments, appointment.memo])

  // ESC key and outside click to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      // TokenCreateModal が開いている時はパネルを閉じない
      if (tokenModalOpen) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    // Delay adding click listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 100)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      clearTimeout(timer)
    }
  }, [isOpen, onClose, tokenModalOpen])

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenu) return
    function handleClick(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [openMenu])

  // Helper: get patient name and last staff id
  const getPatientContext = useCallback(() => {
    const completedPast = pastAppointments.find(a => a.status === 'completed' && a.staff?.id)
    const lastStaffId = completedPast?.staff?.id || appointment.staff_id || undefined
    const pName = patient ? formatPatientName(patient.last_name, patient.first_name) : appointment.patient ? formatPatientName(appointment.patient.last_name, appointment.patient.first_name) : ''
    return { pName, lastStaffId }
  }, [pastAppointments, appointment, patient])

  // Status change handler
  async function handleStatusChange(newStatus: AppointmentStatus) {
    setStatusChanging(true)
    try {
      await onStatusChange(appointment.id, newStatus)
    } catch { /* ignore */ }
    finally { setStatusChanging(false) }
  }

  // Save patient memo
  async function savePatientMemo() {
    setPatientMemoSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/memo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: patientMemo }),
      })
      if (res.ok) {
        setPatientMemoEditing(false)
      }
    } catch { /* ignore */ }
    finally { setPatientMemoSaving(false) }
  }

  // Save appointment memo
  async function saveApptMemo() {
    setApptMemoSaving(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointment.id, memo: apptMemo }),
      })
      if (res.ok) {
        setApptMemoEditing(false)
      }
    } catch { /* ignore */ }
    finally { setApptMemoSaving(false) }
  }

  if (!isOpen) return null

  const currentStatus = appointment.status as AppointmentStatus
  const nextStatus = getNextStatus(currentStatus)
  const prevStatus = getPrevStatus(currentStatus)
  const startDate = new Date(appointment.start_time)
  const endDate = new Date(startDate.getTime() + appointment.duration_minutes * 60 * 1000)
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][startDate.getDay()]

  // Check if patient has any completed appointment (for 初診/再診)
  const hasCompletedPast = stats && stats.totalAppointments > stats.cancelCount + stats.noShowCount + 1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-4 sm:pt-8">
      <div
        ref={panelRef}
        className="w-full max-w-5xl mx-4 rounded-lg bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {loadingDetail ? (
              <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            ) : patient ? (
              <>
                <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                  {patient.chart_number}
                </span>
                <span className="font-bold text-gray-900 truncate">{formatPatientName(patient.last_name, patient.first_name)}</span>
                {(patient.last_name_kana || patient.first_name_kana) && (
                  <span className="text-xs text-gray-400">{formatPatientNameKana(patient.last_name_kana, patient.first_name_kana)}</span>
                )}
                {getPatientTagIcons(patient).map((tag, i) => (
                  <span
                    key={i}
                    title={tag.label}
                    style={{ color: tag.color }}
                    className={`text-sm ${tag.label === '\u611F\u67D3\u6CE8\u610F' ? 'rounded bg-purple-100 px-1' : ''}`}
                  >
                    {tag.icon}
                  </span>
                ))}
                {patient.birth_date && (
                  <span className="text-xs text-gray-500">{calcAge(patient.birth_date)}歳</span>
                )}
                {patient.phone && (
                  <a href={`tel:${patient.phone}`} className="ml-1 text-xs text-emerald-600 hover:underline">
                    {patient.phone}
                  </a>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body: 2-column on md+, 1-column on smaller */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            {/* Left Column (3/5) */}
            <div className="md:col-span-3 p-3 space-y-2">
              {/* Current Appointment */}
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-900">
                  <span className="font-medium">
                    {startDate.getMonth() + 1}/{startDate.getDate()}({dayOfWeek}){' '}
                    {startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜
                    {endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-600">{appointment.appointment_type}</span>
                  {appointment.staff?.name && <span className="text-gray-500">/ {appointment.staff.name}</span>}
                  <span className="text-gray-500">/ 診{appointment.unit_number}</span>
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${hasCompletedPast ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {hasCompletedPast ? '再診' : '初診'}
                  </span>
                </div>
                {/* Lab order info */}
                {appointment.lab_order && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm">
                    <span>{'\uD83E\uDDB7'}</span>
                    <span>{appointment.lab_order.item_type || '技工物'}</span>
                    {appointment.lab_order.tooth_info && (
                      <span className="text-xs text-gray-500">({appointment.lab_order.tooth_info})</span>
                    )}
                    <LabOrderBadge labOrderStatus={appointment.lab_order.status} size="md" />
                  </div>
                )}
              </div>

              {/* Patient Memo */}
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500">患者メモ</h3>
                  {!patientMemoEditing && (
                    <button
                      onClick={() => setPatientMemoEditing(true)}
                      className="text-xs text-emerald-600 hover:underline min-h-[36px] px-1"
                    >
                      編集
                    </button>
                  )}
                </div>
                {patientMemoEditing ? (
                  <div className="mt-1 space-y-1.5">
                    <textarea
                      value={patientMemo}
                      onChange={(e) => setPatientMemo(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setPatientMemoEditing(false); setPatientMemo(patient?.memo || '') }}
                        className="min-h-[36px] rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={savePatientMemo}
                        disabled={patientMemoSaving}
                        className="min-h-[36px] rounded-md bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {patientMemoSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                    {patientMemo || <span className="text-gray-400">メモなし</span>}
                  </p>
                )}
              </div>

              {/* Appointment Memo */}
              <div className="rounded-md border border-emerald-100 bg-emerald-50/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500">予約メモ</h3>
                  {!apptMemoEditing && (
                    <button
                      onClick={() => setApptMemoEditing(true)}
                      className="text-xs text-emerald-600 hover:underline min-h-[36px] px-1"
                    >
                      編集
                    </button>
                  )}
                </div>
                {apptMemoEditing ? (
                  <div className="mt-1 space-y-1.5">
                    <textarea
                      value={apptMemo}
                      onChange={(e) => setApptMemo(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setApptMemoEditing(false); setApptMemo(appointment.memo || '') }}
                        className="min-h-[36px] rounded-md border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={saveApptMemo}
                        disabled={apptMemoSaving}
                        className="min-h-[36px] rounded-md bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {apptMemoSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-2">
                    {apptMemo || <span className="text-gray-400">メモなし</span>}
                  </p>
                )}
              </div>

              {/* Status Buttons */}
              {currentStatus !== 'cancelled' && currentStatus !== 'no_show' ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={!prevStatus || statusChanging}
                      onClick={() => prevStatus && handleStatusChange(prevStatus)}
                      className="min-h-[40px] rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ◀ 戻す
                    </button>
                    <StatusBadge status={currentStatus} size="lg" />
                    <button
                      type="button"
                      disabled={!nextStatus || statusChanging}
                      onClick={() => nextStatus && handleStatusChange(nextStatus)}
                      className="min-h-[40px] rounded-md px-2.5 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: nextStatus ? (STATUS_TEXT[nextStatus] || '#374151') : '#9ca3af',
                      }}
                    >
                      {nextStatus ? `${STATUS_LABELS[nextStatus]}にする ▶` : '完了'}
                    </button>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={statusChanging}
                      onClick={() => handleStatusChange('cancelled')}
                      className="flex-1 min-h-[36px] rounded-md border border-red-300 bg-white px-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      disabled={statusChanging}
                      onClick={() => handleStatusChange('no_show')}
                      className="flex-1 min-h-[36px] rounded-md border border-yellow-400 bg-white px-2 text-xs font-medium text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                    >
                      無断キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-md border px-3 py-2 text-center ${
                  currentStatus === 'no_show' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'
                }`}>
                  <StatusBadge status={currentStatus} size="lg" />
                  <button
                    type="button"
                    disabled={statusChanging}
                    onClick={() => handleStatusChange('scheduled')}
                    className="mt-1.5 w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    未来院に戻す
                  </button>
                </div>
              )}

            </div>

            {/* Right Column (2/5) */}
            <div className="md:col-span-2 p-3 space-y-2">
              <h3 className="text-sm font-bold text-gray-700">{'\u{1F4CB}'} 予約一覧</h3>

              <div className="max-h-[45vh] overflow-y-auto">
              {loadingAppointments && futureAppointments.length === 0 && pastAppointments.length === 0 ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Future */}
                  {futureAppointments.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">── 今後 ──</div>
                      <div className="space-y-0.5">
                        {futureAppointments.map(a => (
                          <AppointmentRow
                            key={a.id}
                            appointment={a}
                            isCurrent={a.id === appointment.id}
                            onJumpToDate={onJumpToDate}
                            onClose={onClose}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past */}
                  {pastAppointments.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">── 過去 ──</div>
                      <div className="space-y-0.5">
                        {pastAppointments.map(a => (
                          <AppointmentRow
                            key={a.id}
                            appointment={a}
                            isCurrent={a.id === appointment.id}
                            onJumpToDate={onJumpToDate}
                            onClose={onClose}
                          />
                        ))}
                      </div>
                      {hasMorePast && (
                        <button
                          onClick={() => fetchAppointments(pastOffset)}
                          disabled={loadingAppointments}
                          className="mt-2 w-full text-center text-xs text-emerald-600 hover:underline min-h-[44px]"
                        >
                          {loadingAppointments ? '読み込み中...' : 'もっと見る'}
                        </button>
                      )}
                    </div>
                  )}

                  {futureAppointments.length === 0 && pastAppointments.length === 0 && (
                    <p className="text-sm text-gray-400">予約履歴はありません</p>
                  )}
                </>
              )}
              </div>

              {/* Stats */}
              {stats && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-1">
                  <div className="text-xs font-medium text-gray-400 mb-1">── 統計 ──</div>
                  <div className="text-xs text-gray-600">
                    最終来院: {stats.lastVisitDate || '—'}
                  </div>
                  <div className="text-xs text-gray-600">
                    予約{stats.totalAppointments}回
                    {' '}
                    <span className={stats.cancelRate >= 10 ? 'text-red-600 font-bold' : ''}>
                      キャンセル{stats.cancelCount}({stats.cancelRate}%)
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className={stats.noShowRate >= 5 ? 'text-red-600 font-bold' : ''}>
                      無断キャンセル{stats.noShowCount}({stats.noShowRate}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Action Buttons + Mobile Close */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2 space-y-2">
          <div className="flex gap-1.5" ref={menuRef}>
            {/* 次回予約 split button */}
            <div className="relative flex flex-1 min-w-0">
              <button
                onClick={() => {
                  const { pName, lastStaffId } = getPatientContext()
                  onNewAppointment(patientId, pName, lastStaffId)
                  onClose()
                }}
                className="flex-1 min-h-[40px] rounded-l-md border border-emerald-300 bg-white px-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
              >
                次回予約
              </button>
              <button
                onClick={() => setOpenMenu(openMenu === 'next' ? null : 'next')}
                className="min-w-[44px] min-h-[40px] rounded-r-md border border-l-0 border-emerald-300 bg-white px-1 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center justify-center"
              >
                ▾
              </button>
              {openMenu === 'next' && (
                <div className="absolute left-0 bottom-full mb-1 z-50 w-full min-w-[160px] rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      const { pName, lastStaffId } = getPatientContext()
                      onNewAppointment(patientId, pName, lastStaffId)
                      onClose()
                    }}
                    className="w-full text-left px-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    空き枠検索
                  </button>
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      const { pName, lastStaffId } = getPatientContext()
                      onCalendarSelect(patientId, pName, lastStaffId)
                      onClose()
                    }}
                    className="w-full text-left px-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center"
                  >
                    カレンダーで選択
                  </button>
                </div>
              )}
            </div>

            {/* 予約変更 split button */}
            <div className="relative flex flex-1 min-w-0">
              <button
                onClick={() => {
                  onEditClick()
                  onClose()
                }}
                className="flex-1 min-h-[40px] rounded-l-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                予約変更
              </button>
              <button
                onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
                className="min-w-[44px] min-h-[40px] rounded-r-md border border-l-0 border-gray-300 bg-white px-1 text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center"
              >
                ▾
              </button>
              {openMenu === 'edit' && (
                <div className="absolute left-0 bottom-full mb-1 z-50 w-full min-w-[180px] rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      onEditClick()
                      onClose()
                    }}
                    className="w-full text-left px-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    内容を編集
                  </button>
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      const { pName, lastStaffId } = getPatientContext()
                      onEditSlotSearch(appointment.id, patientId, pName, lastStaffId)
                      onClose()
                    }}
                    className="w-full text-left px-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center"
                  >
                    空き枠で日時変更
                  </button>
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      const { pName, lastStaffId } = getPatientContext()
                      onEditCalendarSelect(appointment.id, patientId, pName, lastStaffId)
                      onClose()
                    }}
                    className="w-full text-left px-3 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 flex items-center"
                  >
                    カレンダーで日時変更
                  </button>
                </div>
              )}
            </div>

            {/* 案内作成 */}
            <button
              onClick={() => {
                const { lastStaffId } = getPatientContext()
                setLastStaffIdForToken(lastStaffId)
                setTokenModalOpen(true)
              }}
              className="flex-1 min-h-[40px] rounded-md bg-amber-500 px-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700"
            >
              <svg className="mr-1 inline-block h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              案内作成
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full min-h-[44px] rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 sm:hidden"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* Token Create Modal */}
      <TokenCreateModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        patientId={patientId}
        patientName={patient ? formatPatientName(patient.last_name, patient.first_name) : appointment.patient ? formatPatientName(appointment.patient.last_name, appointment.patient.first_name) : ''}
        chartNumber={patient?.chart_number || appointment.patient?.chart_number || ''}
        lastStaffId={lastStaffIdForToken}
      />
    </div>
  )
}

function AppointmentRow({
  appointment,
  isCurrent,
  onJumpToDate,
  onClose,
}: {
  appointment: AppointmentListItem
  isCurrent: boolean
  onJumpToDate: (date: string) => void
  onClose: () => void
}) {
  const date = new Date(appointment.start_time)
  const dateStr = `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, '0')}`
  const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const staffName = appointment.staff?.name || ''
  const type = appointment.appointment_type.length > 5
    ? appointment.appointment_type.substring(0, 5)
    : appointment.appointment_type
  const statusShort = STATUS_SHORT[appointment.status] || ''
  const jumpDate = date.toISOString().split('T')[0]

  return (
    <button
      onClick={() => {
        onJumpToDate(jumpDate)
        onClose()
      }}
      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-50 min-h-[36px] flex items-center gap-1 ${
        isCurrent ? 'bg-emerald-50 font-bold' : ''
      }`}
    >
      {isCurrent && <span className="text-emerald-600">●</span>}
      <span className="text-gray-600">{dateStr}</span>
      <span className="text-gray-500">{timeStr}</span>
      <span className="text-gray-700 truncate">{staffName}</span>
      <span className="text-gray-700 truncate">{type}</span>
      {statusShort && (
        <span className={`ml-auto text-[10px] flex-shrink-0 ${
          appointment.status === 'cancelled' || appointment.status === 'no_show'
            ? 'text-red-500' : 'text-gray-400'
        }`}>
          {statusShort}
        </span>
      )}
    </button>
  )
}
