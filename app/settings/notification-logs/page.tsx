'use client'

import { useState, useCallback, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'

type NotificationLogEntry = {
  id: string
  patient_id: string
  appointment_id: string | null
  channel: string
  type: string
  status: string
  content: string | null
  error_message: string | null
  created_at: string
  patient?: { last_name: string; first_name: string; chart_number: string } | null
}

const CHANNEL_LABELS: Record<string, string> = {
  line: 'LINE',
  email: 'メール',
}

const TYPE_LABELS: Record<string, string> = {
  reminder: 'リマインド',
  booking_confirm: '予約確認',
  booking_change: '予約変更',
  booking_cancel: 'キャンセル',
  approval_result: '承認結果',
  token_sent: 'トークン送信',
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const PAGE_SIZE = 30

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // フィルタ
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const [startDate, setStartDate] = useState(formatDate(weekAgo))
  const [endDate, setEndDate] = useState(formatDate(today))
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      if (channel) params.set('channel', channel)
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))

      const res = await fetch(`/api/notification-logs?${params}`)
      const data = await res.json()

      if (res.ok) {
        setLogs(prev => append ? [...prev, ...(data.logs || [])] : (data.logs || []))
        setTotal(data.total || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, channel, status, type])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchLogs()
  }

  function handleLoadMore() {
    fetchLogs(logs.length, true)
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-3">
          <a
            href="/settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-xl font-bold text-gray-900">通知ログ</h1>
        </div>

        {/* フィルタ */}
        <form onSubmit={handleSearch} className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">開始日</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">終了日</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">チャネル</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                <option value="line">LINE</option>
                <option value="email">メール</option>
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">ステータス</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                <option value="sent">送信済み</option>
                <option value="failed">失敗</option>
                <option value="pending">保留</option>
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">種別</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                <option value="reminder">リマインド</option>
                <option value="booking_confirm">予約確認</option>
                <option value="booking_change">予約変更</option>
                <option value="booking_cancel">キャンセル</option>
                <option value="approval_result">承認結果</option>
                <option value="token_sent">トークン送信</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={loading}>
                検索
              </Button>
            </div>
          </div>
        </form>

        {/* 件数 */}
        <div className="mb-2 text-xs text-gray-500">
          {total}件中 {logs.length}件表示
        </div>

        {/* ログ一覧 */}
        <div className="space-y-1">
          {logs.map(log => {
            const date = new Date(log.created_at)
            const dateStr = date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
            const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            const isExpanded = expandedId === log.id

            return (
              <div key={log.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-shrink-0 text-xs text-gray-400 w-20">
                      {dateStr} {timeStr}
                    </span>
                    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                      log.channel === 'line' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {CHANNEL_LABELS[log.channel] || log.channel}
                    </span>
                    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[log.status] || ''
                    }`}>
                      {log.status === 'sent' ? '送信済' : log.status === 'failed' ? '失敗' : '保留'}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-500">
                      {TYPE_LABELS[log.type] || log.type}
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {log.patient ? `${log.patient.last_name} ${log.patient.first_name}`.trim() : '—'}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="mx-2 rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 p-3">
                    {log.error_message && (
                      <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600">
                        エラー: {log.error_message}
                      </div>
                    )}
                    {log.content && (
                      <div className="rounded bg-white p-2 text-xs text-gray-700 whitespace-pre-wrap border border-gray-100">
                        {log.content}
                      </div>
                    )}
                    <div className="mt-2 text-[10px] text-gray-400">
                      ID: {log.id}
                      {log.patient?.chart_number && ` / カルテNo: ${log.patient.chart_number}`}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {logs.length === 0 && !loading && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-400">通知ログはありません</p>
          </div>
        )}

        {loading && (
          <div className="py-4 text-center text-sm text-gray-400">読み込み中...</div>
        )}

        {/* もっと読み込む */}
        {logs.length < total && !loading && (
          <div className="mt-4 text-center">
            <Button variant="secondary" onClick={handleLoadMore}>
              もっと読み込む
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
