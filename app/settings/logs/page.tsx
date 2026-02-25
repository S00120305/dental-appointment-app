'use client'

import { useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useStaff } from '@/hooks/useStaff'
import type { AppointmentLog } from '@/lib/supabase/types'

const ACTION_BADGES: Record<string, { label: string; color: string }> = {
  create: { label: '作成', color: 'bg-green-100 text-green-800' },
  update: { label: '更新', color: 'bg-blue-100 text-blue-800' },
  delete: { label: '削除', color: 'bg-red-100 text-red-800' },
  status_change: { label: 'ステータス', color: 'bg-yellow-100 text-yellow-800' },
  import: { label: 'インポート', color: 'bg-purple-100 text-purple-800' },
}

const TARGET_TYPES = [
  { value: '', label: 'すべて' },
  { value: 'appointment', label: '予約' },
  { value: 'patient', label: '患者' },
  { value: 'blocked_slot', label: 'ブロック枠' },
  { value: 'setting', label: '設定' },
]

export default function LogsPage() {
  const { staffList } = useStaff()
  const [logs, setLogs] = useState<AppointmentLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // フィルタ
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [userId, setUserId] = useState('')
  const [targetType, setTargetType] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 30

  const fetchLogs = useCallback(async (newOffset: number = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      if (userId) params.set('user_id', userId)
      if (targetType) params.set('target_type', targetType)
      params.set('limit', String(LIMIT))
      params.set('offset', String(newOffset))

      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()

      if (newOffset === 0) {
        setLogs(data.logs || [])
      } else {
        setLogs(prev => [...prev, ...(data.logs || [])])
      }
      setTotal(data.total ?? 0)
      setOffset(newOffset)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, userId, targetType])

  const handleSearch = () => {
    setExpandedId(null)
    fetchLogs(0)
  }

  const handleLoadMore = () => {
    fetchLogs(offset + LIMIT)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">操作ログ</h1>

        {/* フィルタ */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">開始日</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">終了日</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">操作者</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">すべて</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">種別</label>
              <select
                value={targetType}
                onChange={e => setTargetType(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {TARGET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-3 w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>

        {/* 件数 */}
        {total > 0 && (
          <p className="mb-2 text-sm text-gray-500">
            {total}件中 {logs.length}件表示
          </p>
        )}

        {/* ログ一覧 */}
        <div className="space-y-1">
          {logs.map(log => {
            const badge = ACTION_BADGES[log.action_type] || { label: log.action_type, color: 'bg-gray-100 text-gray-800' }
            const isExpanded = expandedId === log.id

            return (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatDate(log.created_at)}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {log.summary}
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {log.user_name && (
                    <span className="mt-1 block text-xs text-gray-400">
                      操作者: {log.user_name}
                    </span>
                  )}
                </button>
                {isExpanded && log.details && Object.keys(log.details).length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 p-3">
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 初期状態・空 */}
        {!loading && logs.length === 0 && total === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">「検索」ボタンを押してログを表示してください</p>
          </div>
        )}

        {/* もっと読み込む */}
        {logs.length < total && (
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="mt-4 w-full rounded border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '読み込み中...' : 'もっと読み込む'}
          </button>
        )}
      </div>
    </AppLayout>
  )
}
