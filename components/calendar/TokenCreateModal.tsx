'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Button from '@/components/ui/Button'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type BookingTypeOption = {
  id: string
  display_name: string
  duration_minutes: number
  is_active: boolean
}

type StaffOption = {
  id: string
  name: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  chartNumber: string
}

export default function TokenCreateModal({ isOpen, onClose, patientId, patientName, chartNumber }: Props) {
  const { data: typesData } = useSWR<{ booking_types: BookingTypeOption[] }>(
    isOpen ? '/api/booking-types' : null,
    fetcher
  )
  const { data: staffData } = useSWR<{ users: StaffOption[] }>(
    isOpen ? '/api/users?active_only=true' : null,
    fetcher
  )

  const [bookingTypeId, setBookingTypeId] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [staffId, setStaffId] = useState('')
  const [expiresDays, setExpiresDays] = useState(7)
  const [memo, setMemo] = useState('')
  const [sendMethod, setSendMethod] = useState<'line' | 'email' | 'none'>('none')
  const [submitting, setSubmitting] = useState(false)

  // 作成完了状態
  const [result, setResult] = useState<{
    token: string
    url: string
    notification: { channel: string; success: boolean } | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bookingTypes = (typesData?.booking_types || []).filter(t => t.is_active)
  const staffList = staffData?.users || []

  // 予約種別が変わったらデフォルト所要時間を設定
  useEffect(() => {
    if (bookingTypeId) {
      const bt = bookingTypes.find(t => t.id === bookingTypeId)
      if (bt) setDurationMinutes(bt.duration_minutes)
    }
  }, [bookingTypeId, bookingTypes])

  // モーダルを開いたときにリセット
  useEffect(() => {
    if (isOpen) {
      setBookingTypeId('')
      setDurationMinutes(30)
      setStaffId('')
      setExpiresDays(7)
      setMemo('')
      setSendMethod('none')
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  const handleCreate = async () => {
    if (!bookingTypeId) {
      setError('予約種別を選択してください')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/booking-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          booking_type_id: bookingTypeId,
          duration_minutes: durationMinutes,
          staff_id: staffId || null,
          expires_days: expiresDays,
          memo: memo.trim() || null,
          send_method: sendMethod,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || '作成に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  // 所要時間選択肢（5分刻み）
  const durationOptions = Array.from({ length: 24 }, (_, i) => (i + 1) * 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {result ? (
          /* 作成完了 */
          <>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h3 className="mt-3 text-lg font-bold text-gray-900">ご案内を作成しました</h3>
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <span className="text-xs text-gray-500">ご案内番号</span>
                <p className="font-mono text-lg font-bold text-gray-900">{result.token}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">予約ページ</span>
                <p className="break-all text-xs text-blue-600">{result.url}</p>
              </div>
            </div>

            {result.notification && (
              <div className={`mt-3 rounded-md p-3 text-sm ${result.notification.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {result.notification.success
                  ? result.notification.channel === 'line'
                    ? 'LINEで送信しました'
                    : 'メールで送信しました'
                  : '通知の送信に失敗しました'}
              </div>
            )}
            {sendMethod === 'none' && (
              <p className="mt-3 text-sm text-gray-600">
                患者様にご案内番号をお伝えください
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={onClose}>閉じる</Button>
            </div>
          </>
        ) : (
          /* 作成フォーム */
          <>
            <h3 className="text-lg font-bold text-gray-900">次回予約のご案内を作成</h3>
            <p className="mt-1 text-sm text-gray-600">
              {patientName}（{chartNumber}）
            </p>

            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-4 space-y-4">
              {/* 予約種別 */}
              <div>
                <label className="block text-sm font-medium text-gray-700">予約種別</label>
                <select
                  value={bookingTypeId}
                  onChange={(e) => setBookingTypeId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">選択してください</option>
                  {bookingTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}（{t.duration_minutes}分）</option>
                  ))}
                </select>
              </div>

              {/* 所要時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700">所要時間</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {durationOptions.map(d => (
                    <option key={d} value={d}>{d}分</option>
                  ))}
                </select>
              </div>

              {/* 担当スタッフ */}
              <div>
                <label className="block text-sm font-medium text-gray-700">担当スタッフ</label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">指定なし</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* 有効期限 */}
              <div>
                <label className="block text-sm font-medium text-gray-700">有効期限</label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(parseInt(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value={7}>7日間</option>
                  <option value={14}>14日間</option>
                  <option value={30}>30日間</option>
                </select>
              </div>

              {/* メモ */}
              <div>
                <label className="block text-sm font-medium text-gray-700">メモ（患者には見えません）</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="例: 次回は左上のクラウン"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* 送信方法 */}
              <div>
                <label className="block text-sm font-medium text-gray-700">送信方法</label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sendMethod"
                      value="line"
                      checked={sendMethod === 'line'}
                      onChange={() => setSendMethod('line')}
                      className="h-4 w-4"
                    />
                    LINEで送信
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sendMethod"
                      value="email"
                      checked={sendMethod === 'email'}
                      onChange={() => setSendMethod('email')}
                      className="h-4 w-4"
                    />
                    メールで送信
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sendMethod"
                      value="none"
                      checked={sendMethod === 'none'}
                      onChange={() => setSendMethod('none')}
                      className="h-4 w-4"
                    />
                    送信しない（番号を口頭で伝える）
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <Button onClick={handleCreate} disabled={submitting || !bookingTypeId}>
                {submitting ? '作成中...' : '作成する'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
