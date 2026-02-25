'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { useToast } from '@/components/ui/Toast'
import { getPinSession } from '@/lib/auth/session'

interface BackupRequest {
  id: string
  request_type: 'manual' | 'scheduled'
  status: 'pending' | 'running' | 'completed' | 'failed'
  backup_type: 'full' | 'db_only' | 'storage_only'
  started_at: string | null
  completed_at: string | null
  file_size_mb: number | null
  error_message: string | null
  notes: string | null
  created_at: string
  users: { name: string } | null
}

export default function BackupPage() {
  const { showToast } = useToast()
  const [backups, setBackups] = useState<BackupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [pollingActive, setPollingActive] = useState(false)

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/backup?limit=20')
      const data = await res.json()
      if (res.ok && data.backups) {
        setBackups(data.backups)
        const hasActive = data.backups.some(
          (b: BackupRequest) => b.status === 'pending' || b.status === 'running'
        )
        setPollingActive(hasActive)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  // 実行中はポーリング（5秒間隔）
  useEffect(() => {
    if (!pollingActive) return
    const interval = setInterval(fetchBackups, 5000)
    return () => clearInterval(interval)
  }, [pollingActive, fetchBackups])

  const triggerBackup = async (backupType: 'full' | 'db_only' | 'storage_only') => {
    const session = getPinSession()
    if (!session) return

    setTriggering(true)
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.userId, backupType }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'バックアップリクエストに失敗しました', 'error')
        return
      }

      showToast('バックアップリクエストを送信しました', 'success')
      setPollingActive(true)
      fetchBackups()
    } catch {
      showToast('バックアップリクエストに失敗しました', 'error')
    } finally {
      setTriggering(false)
    }
  }

  const hasActiveBackup = backups.some(
    b => b.status === 'pending' || b.status === 'running'
  )

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { text: '待機中', color: 'bg-yellow-100 text-yellow-800' }
      case 'running': return { text: '実行中', color: 'bg-blue-100 text-blue-800' }
      case 'completed': return { text: '完了', color: 'bg-green-100 text-green-800' }
      case 'failed': return { text: '失敗', color: 'bg-red-100 text-red-800' }
      default: return { text: status, color: 'bg-gray-100 text-gray-800' }
    }
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case 'full': return 'DB + 画像'
      case 'db_only': return 'DBのみ'
      case 'storage_only': return '画像のみ'
      default: return type
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (backup: BackupRequest) => {
    if (!backup.started_at || !backup.completed_at) return null
    const start = new Date(backup.started_at).getTime()
    const end = new Date(backup.completed_at).getTime()
    const sec = Math.round((end - start) / 1000)
    if (sec < 60) return `${sec}秒`
    return `${Math.floor(sec / 60)}分${sec % 60}秒`
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">バックアップ</h1>
        </div>

        {/* 説明 */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm text-gray-600">
            NAS（院内サーバー）へのデータバックアップを管理します。
            毎日 AM 3:00 にDB、AM 3:30 に画像の自動バックアップが実行されます。
            手動で即時バックアップを実行することもできます。
          </p>
        </div>

        {/* 手動バックアップボタン */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-3 font-medium text-gray-900">手動バックアップ</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => triggerBackup('full')}
              disabled={triggering || hasActiveBackup}
              className="min-h-[44px] min-w-[44px] rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {triggering ? '送信中...' : hasActiveBackup ? 'バックアップ実行中...' : '全体バックアップ（DB + 画像）'}
            </button>
            <button
              onClick={() => triggerBackup('db_only')}
              disabled={triggering || hasActiveBackup}
              className="min-h-[44px] min-w-[44px] rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              DBのみ
            </button>
            <button
              onClick={() => triggerBackup('storage_only')}
              disabled={triggering || hasActiveBackup}
              className="min-h-[44px] min-w-[44px] rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              画像のみ
            </button>
          </div>

          {/* 実行中インジケーター */}
          {hasActiveBackup && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm text-blue-800">
                NASでバックアップを実行中です...（5秒ごとに自動更新）
              </span>
            </div>
          )}
        </div>

        {/* バックアップ履歴 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-3 font-medium text-gray-900">実行履歴</h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : backups.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">バックアップ履歴はありません</p>
          ) : (
            <div className="space-y-2">
              {backups.map(backup => {
                const status = statusLabel(backup.status)
                const duration = formatDuration(backup)

                return (
                  <div
                    key={backup.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {backup.status === 'running' && (
                          <span className="mr-1 inline-block h-2 w-2 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                        )}
                        {status.text}
                      </span>
                      <span className="text-sm text-gray-700">{typeLabel(backup.backup_type)}</span>
                      <span className="text-sm text-gray-500">{formatDate(backup.created_at)}</span>
                      {backup.file_size_mb !== null && (
                        <span className="text-xs text-gray-400">{backup.file_size_mb}MB</span>
                      )}
                      {duration && (
                        <span className="text-xs text-gray-400">{duration}</span>
                      )}
                      {backup.users?.name && (
                        <span className="text-xs text-gray-400">by {backup.users.name}</span>
                      )}
                      {backup.request_type === 'scheduled' && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">自動</span>
                      )}
                    </div>
                    {backup.error_message && (
                      <p className="mt-1.5 text-xs text-red-600">{backup.error_message}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
