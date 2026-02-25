'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import AppLayout from '@/components/layout/AppLayout'

// recharts を dynamic import（SSR無効）
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

type TabType = 'appointments' | 'utilization' | 'patient-type' | 'booking-source'
type PeriodType = 'today' | 'week' | 'month' | 'last-month' | 'custom'

const TABS: { key: TabType; label: string }[] = [
  { key: 'appointments', label: '予約数' },
  { key: 'utilization', label: '稼働率' },
  { key: 'patient-type', label: '新既区分' },
  { key: 'booking-source', label: '予約経路' },
]

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateRange(period: PeriodType, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { start: formatDate(now), end: formatDate(now) }
    case 'week': {
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { start: formatDate(monday), end: formatDate(sunday) }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: formatDate(first), end: formatDate(last) }
    }
    case 'last-month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: formatDate(first), end: formatDate(last) }
    }
    case 'custom':
      return { start: customStart, end: customEnd }
    default:
      return { start: formatDate(now), end: formatDate(now) }
  }
}

function calcChange(current: number, previous: number): { diff: number; label: string } {
  if (previous === 0) return { diff: 0, label: '-' }
  const pct = Math.round((current - previous) / previous * 1000) / 10
  if (pct > 0) return { diff: pct, label: `\u25B2${pct}%` }
  if (pct < 0) return { diff: pct, label: `\u25BC${Math.abs(pct)}%` }
  return { diff: 0, label: '\u2015 0%' }
}

// KPI Card
function KpiCard({ title, value, unit, change, color }: {
  title: string; value: string | number; unit?: string
  change?: { diff: number; label: string }; color?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${color || 'text-gray-900'}`}>{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {change && (
        <p className={`mt-1 text-xs ${change.diff > 0 ? 'text-green-600' : change.diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
          {change.label} 前期間比
        </p>
      )}
    </div>
  )
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appointments')
  const [period, setPeriod] = useState<PeriodType>('month')
  const [customStart, setCustomStart] = useState(formatDate(new Date()))
  const [customEnd, setCustomEnd] = useState(formatDate(new Date()))
  const [loading, setLoading] = useState(false)

  // Data states
  const [apptData, setApptData] = useState<Record<string, unknown> | null>(null)
  const [utilData, setUtilData] = useState<Record<string, unknown> | null>(null)
  const [ptData, setPtData] = useState<Record<string, unknown> | null>(null)
  const [bsData, setBsData] = useState<Record<string, unknown> | null>(null)

  const { start, end } = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = `start_date=${start}&end_date=${end}`
    try {
      const res = await fetch(`/api/statistics/${activeTab}?${params}`)
      const data = await res.json()
      if (res.ok) {
        switch (activeTab) {
          case 'appointments': setApptData(data); break
          case 'utilization': setUtilData(data); break
          case 'patient-type': setPtData(data); break
          case 'booking-source': setBsData(data); break
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [activeTab, start, end])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <AppLayout>
      <div className="p-2 sm:p-4 max-w-6xl mx-auto">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">統計</h1>

        {/* 期間セレクター */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { key: 'today', label: '今日' },
            { key: 'week', label: '今週' },
            { key: 'month', label: '今月' },
            { key: 'last-month', label: '先月' },
            { key: 'custom', label: 'カスタム' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as PeriodType)}
              className={`min-h-[44px] rounded-md px-3 text-sm font-medium ${
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
            </div>
          )}
          <span className="text-xs text-gray-400">
            {start} 〜 {end}
          </span>
        </div>

        {/* タブ */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-[44px] whitespace-nowrap px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <>
            {activeTab === 'appointments' && apptData && <AppointmentsTab data={apptData} />}
            {activeTab === 'utilization' && utilData && <UtilizationTab data={utilData} />}
            {activeTab === 'patient-type' && ptData && <PatientTypeTab data={ptData} />}
            {activeTab === 'booking-source' && bsData && <BookingSourceTab data={bsData} />}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ===== タブ1: 予約数 =====
function AppointmentsTab({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    total: number; visited: number; cancelled: number; noShow: number; cancelRate: number
    prev: { total: number; visited: number; cancelled: number; noShow: number }
    dailyData: { date: string; total: number; visited: number; cancelled: number }[]
    dowData: { dow: string; avg: number; total: number }[]
  }

  return (
    <div className="space-y-6">
      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard title="予約数" value={d.total} unit="件" color="text-blue-600"
          change={calcChange(d.total, d.prev.total)} />
        <KpiCard title="来院数" value={d.visited} unit="件" color="text-green-600"
          change={calcChange(d.visited, d.prev.visited)} />
        <KpiCard title="キャンセル" value={d.cancelled} unit="件" color="text-red-600"
          change={calcChange(d.cancelled, d.prev.cancelled)} />
        <KpiCard title="無断キャンセル" value={d.noShow} unit="件" color="text-amber-600"
          change={calcChange(d.noShow, d.prev.noShow)} />
      </div>

      {/* キャンセル率 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">キャンセル率</p>
        <span className="text-3xl font-bold text-gray-900">{d.cancelRate}%</span>
      </div>

      {/* 日別推移グラフ */}
      {d.dailyData.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">日別推移</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="予約数" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="visited" name="来院数" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cancelled" name="キャンセル" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 曜日別集計 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">曜日別 平均予約数</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.dowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dow" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="avg" name="平均" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ===== タブ2: 稼働率 =====
function UtilizationTab({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    overallRate: number; avgPerDay: number
    prev: { overallRate: number; avgPerDay: number }
    unitData: { unit: number; rate: number; count: number; bookedHours: number; freeHours: number }[]
    dailyData: { date: string; rate: number; count: number }[]
    hourlyHeatmap: { hour: number; dow: string; count: number }[]
    businessDays: number
  }

  const maxHeatCount = Math.max(...d.hourlyHeatmap.map(h => h.count), 1)

  return (
    <div className="space-y-6">
      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="全体稼働率" value={`${d.overallRate}%`} color="text-blue-600"
          change={calcChange(d.overallRate, d.prev.overallRate)} />
        <KpiCard title="平均予約数/日" value={d.avgPerDay} unit="件"
          change={calcChange(d.avgPerDay, d.prev.avgPerDay)} />
      </div>

      {/* ユニット別テーブル */}
      {d.unitData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
          <h3 className="mb-3 text-sm font-medium text-gray-700">ユニット別稼働率</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4">ユニット</th>
                <th className="py-2 pr-4">稼働率</th>
                <th className="py-2 pr-4">予約件数</th>
                <th className="py-2 pr-4">稼働時間</th>
                <th className="py-2">空き時間</th>
              </tr>
            </thead>
            <tbody>
              {d.unitData.map((u) => (
                <tr key={u.unit} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">診察室{u.unit}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(u.rate, 100)}%` }}
                        />
                      </div>
                      <span>{u.rate}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">{u.count}件</td>
                  <td className="py-2 pr-4">{u.bookedHours}h</td>
                  <td className="py-2">{u.freeHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 日別稼働率推移 */}
      {d.dailyData.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">日別稼働率推移</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="rate" name="稼働率" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 時間帯ヒートマップ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-700">時間帯別予約数（ヒートマップ）</h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-1 py-1 text-gray-400">時間</th>
                {['月', '火', '水', '木', '金', '土', '日'].map(d => (
                  <th key={d} className="px-1 py-1 text-gray-500 font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                <tr key={hour}>
                  <td className="px-1 py-0.5 text-gray-400 text-right">{hour}:00</td>
                  {['月', '火', '水', '木', '金', '土', '日'].map(dow => {
                    const cell = d.hourlyHeatmap.find(h => h.hour === hour && h.dow === dow)
                    const count = cell?.count || 0
                    const intensity = count / maxHeatCount
                    const bg = count === 0 ? '#f3f4f6'
                      : intensity < 0.33 ? '#bfdbfe'
                      : intensity < 0.66 ? '#60a5fa'
                      : '#2563eb'
                    const text = intensity > 0.5 ? 'white' : '#374151'
                    return (
                      <td key={dow} className="px-0.5 py-0.5">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded text-[10px]"
                          style={{ backgroundColor: bg, color: text }}
                          title={`${dow} ${hour}:00 - ${count}件`}
                        >
                          {count || ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== タブ3: 新既区分 =====
function PatientTypeTab({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    newPatients: number; revisit: number; returning: number
    prev: { newPatients: number }
    totalPatients: number
  }

  const pieData = [
    { name: '新患', value: d.newPatients },
    { name: '再初診', value: d.revisit },
    { name: '再診', value: d.returning },
  ].filter(p => p.value > 0)

  const total = d.newPatients + d.revisit + d.returning
  const newRate = total > 0 ? Math.round(d.newPatients / total * 1000) / 10 : 0

  return (
    <div className="space-y-6">
      {/* KPI カード */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard title="新患" value={d.newPatients} unit="人" color="text-blue-600"
          change={calcChange(d.newPatients, d.prev.newPatients)} />
        <KpiCard title="再初診" value={d.revisit} unit="人" color="text-amber-600" />
        <KpiCard title="再診" value={d.returning} unit="人" color="text-green-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* 新患比率ドーナツチャート */}
        {pieData.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">新患比率</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={(props: any) =>
                      `${props.name || ''} ${((props.percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* サマリー */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-700">サマリー</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">期間内 来院患者数</p>
              <p className="text-2xl font-bold text-gray-900">{d.totalPatients}<span className="text-sm font-normal text-gray-500"> 人</span></p>
            </div>
            <div>
              <p className="text-sm text-gray-500">新患比率</p>
              <p className="text-2xl font-bold text-blue-600">{newRate}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">再初診比率</p>
              <p className="text-2xl font-bold text-amber-600">
                {total > 0 ? Math.round(d.revisit / total * 1000) / 10 : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== タブ4: 予約経路 =====
function BookingSourceTab({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    sourceData: { source: string; label: string; count: number; rate: number }[]
    total: number
    prev: { sourceCounts: Record<string, number>; total: number }
    monthlyData: { month: string; internal: number; web: number; phone: number; line: number }[]
  }

  const sourceLabels: Record<string, string> = {
    internal: '受付',
    web: 'Web予約',
    phone: '電話',
    line: 'LINE',
  }

  const sourceColors: Record<string, string> = {
    internal: '#3b82f6',
    web: '#10b981',
    phone: '#f59e0b',
    line: '#06b6d4',
  }

  return (
    <div className="space-y-6">
      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {d.sourceData.map((s) => {
          const prevCount = d.prev.sourceCounts[s.source] || 0
          return (
            <KpiCard
              key={s.source}
              title={s.label}
              value={s.count}
              unit={`件 (${s.rate}%)`}
              change={calcChange(s.count, prevCount)}
            />
          )
        })}
        {d.sourceData.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-400">データなし</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* ドーナツチャート */}
        {d.sourceData.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">経路別比率</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d.sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="label"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={(props: any) =>
                      `${props.label || ''} ${props.rate || 0}%`
                    }
                  >
                    {d.sourceData.map((s) => (
                      <Cell key={s.source} fill={sourceColors[s.source] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 月別推移 */}
        {d.monthlyData.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-700">月別推移</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {Object.entries(sourceLabels).map(([key, label]) => (
                    <Bar key={key} dataKey={key} name={label} stackId="a"
                      fill={sourceColors[key] || '#9ca3af'} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
