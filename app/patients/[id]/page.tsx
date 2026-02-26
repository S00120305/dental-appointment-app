'use client'

import { useState, useEffect, useCallback, use } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/calendar/StatusBadge'
import LabOrderBadge from '@/components/calendar/LabOrderBadge'
import { getPatientTagIcons } from '@/lib/constants/patient-tags'
import { formatPhone } from '@/lib/utils/phone'
import type { Patient, AppointmentWithRelations, LabOrderWithLab } from '@/lib/supabase/types'

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [labOrders, setLabOrders] = useState<LabOrderWithLab[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'appointments' | 'labOrders'>('info')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 患者情報取得
      const patientRes = await fetch(`/api/patients?search=${encodeURIComponent(id)}`)
      const patientData = await patientRes.json()
      // search で id が含まれる結果から正確なマッチを取得
      const found = (patientData.patients || []).find((p: Patient) => p.id === id)
      if (found) {
        setPatient(found)

        // 予約履歴取得（全期間）
        const apptRes = await fetch(`/api/appointments?patient_id=${found.id}`)
        const apptData = await apptRes.json()
        if (apptRes.ok) setAppointments(apptData.appointments || [])

        // 技工物履歴取得（chart_number で検索）
        const labRes = await fetch(`/api/lab-orders?patient_id=${encodeURIComponent(found.chart_number)}`)
        const labData = await labRes.json()
        if (labRes.ok) setLabOrders(labData.lab_orders || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      </AppLayout>
    )
  }

  if (!patient) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">患者が見つかりません</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const now = new Date()
  const futureAppointments = appointments.filter(a => new Date(a.start_time) >= now && a.status !== 'cancelled' && a.status !== 'no_show')
  const pastAppointments = appointments.filter(a => new Date(a.start_time) < now || a.status === 'cancelled' || a.status === 'no_show')

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-3">
          <a
            href="/patients"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {patient.chart_number}
              </span>
              <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
              {getPatientTagIcons(patient).map((tag, i) => (
                <span
                  key={i}
                  title={tag.label}
                  style={{ color: tag.color }}
                  className={`text-base ${tag.label === '\u611F\u67D3\u6CE8\u610F' ? 'rounded bg-purple-100 px-1' : ''}`}
                >
                  {tag.icon}
                </span>
              ))}
            </div>
            {patient.name_kana && (
              <p className="text-sm text-gray-500">{patient.name_kana}</p>
            )}
          </div>
        </div>

        {/* タブ */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          {[
            { key: 'info' as const, label: '基本情報' },
            { key: 'appointments' as const, label: `予約 (${appointments.length})` },
            { key: 'labOrders' as const, label: `技工物 (${labOrders.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-[44px] px-4 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 基本情報タブ */}
        {activeTab === 'info' && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              <InfoRow label="カルテNo" value={patient.chart_number} />
              <InfoRow label="氏名" value={patient.name} />
              <InfoRow label="フリガナ" value={patient.name_kana || '—'} />
              <InfoRow label="性別" value={patient.gender || '—'} />
              <InfoRow label="生年月日" value={patient.date_of_birth || '—'} />
              <InfoRow label="電話番号" value={patient.phone ? formatPhone(patient.phone) : '—'} />
              <InfoRow label="メール" value={patient.email || '—'} />
              <InfoRow label="郵便番号" value={patient.postal_code || '—'} />
              <InfoRow label="住所" value={patient.address || '—'} />
              <InfoRow
                label="通知方法"
                value={
                  patient.preferred_notification === 'line' ? 'LINE' :
                  patient.preferred_notification === 'email' ? 'メール' :
                  '通知なし'
                }
              />
              <InfoRow label="LINE連携" value={patient.line_user_id ? '連携済み' : '未連携'} />
              <InfoRow label="VIP" value={patient.is_vip ? '\u2B50 VIP' : '\u2014'} />
              <InfoRow
                label="注意レベル"
                value={
                  patient.caution_level === 1 ? '\u26A0 \u6CE8\u610F\u2460' :
                  patient.caution_level === 2 ? '\u26A0\u26A0 \u6CE8\u610F\u2461' :
                  patient.caution_level === 3 ? '\u26A0\u26A0\u26A0 \u6CE8\u610F\u2462' : '\u2014'
                }
              />
              <InfoRow label="感染注意" value={patient.is_infection_alert ? '\u266A \u611F\u67D3\u6CE8\u610F' : '\u2014'} />
            </div>
          </div>
        )}

        {/* 予約履歴タブ */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            {/* 今後の予約 */}
            {futureAppointments.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-emerald-600">今後の予約</h3>
                <div className="space-y-2">
                  {futureAppointments.map(a => (
                    <AppointmentCard key={a.id} appointment={a} highlight />
                  ))}
                </div>
              </div>
            )}

            {/* 過去の予約 */}
            {pastAppointments.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-500">過去の予約</h3>
                <div className="space-y-2">
                  {pastAppointments.map(a => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                </div>
              </div>
            )}

            {appointments.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-400">予約履歴はありません</p>
              </div>
            )}
          </div>
        )}

        {/* 技工物履歴タブ */}
        {activeTab === 'labOrders' && (
          <div className="space-y-2">
            {labOrders.length > 0 ? (
              labOrders.map(lo => (
                <LabOrderCard key={lo.id} labOrder={lo} />
              ))
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-400">技工物の履歴はありません</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="w-28 text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

function AppointmentCard({ appointment, highlight }: { appointment: AppointmentWithRelations; highlight?: boolean }) {
  const date = new Date(appointment.start_time)
  const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]

  return (
    <div className={`rounded-lg border bg-white px-4 py-3 shadow-sm ${
      highlight ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {dateStr} ({dayOfWeek}) {timeStr}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {appointment.appointment_type} / 診察室{appointment.unit_number}
            {appointment.staff?.name && ` / ${appointment.staff.name}`}
          </div>
        </div>
        <StatusBadge status={appointment.status} size="sm" />
      </div>
      {appointment.lab_order && (
        <div className="mt-1">
          <LabOrderBadge labOrderStatus={appointment.lab_order.status} size="md" />
        </div>
      )}
    </div>
  )
}

function LabOrderCard({ labOrder }: { labOrder: LabOrderWithLab }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {labOrder.item_type || '技工物'}
            </span>
            {labOrder.tooth_info && (
              <span className="text-xs text-gray-500">({labOrder.tooth_info})</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {labOrder.lab?.name || '—'}
            {labOrder.due_date && ` / 納期: ${labOrder.due_date}`}
            {labOrder.set_date && ` / セット日: ${labOrder.set_date}`}
          </div>
        </div>
        <LabOrderBadge labOrderStatus={labOrder.status} size="md" />
      </div>
      {labOrder.memo && (
        <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600 whitespace-pre-wrap">
          {labOrder.memo}
        </div>
      )}
    </div>
  )
}
