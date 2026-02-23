'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { BlockedSlot } from '@/lib/supabase/types'

type BlockedSlotModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  blockedSlot?: BlockedSlot | null // null = 作成モード, 指定 = 詳細モード
  defaultDate?: string // YYYY-MM-DD
  defaultStartTime?: string // HH:mm
  defaultEndTime?: string // HH:mm
  defaultUnitNumber?: number
  unitCount?: number
  businessHours?: { start: string; end: string }
}

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

export default function BlockedSlotModal({
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  blockedSlot,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultUnitNumber,
  unitCount = 5,
  businessHours = { start: '09:00', end: '18:00' },
}: BlockedSlotModalProps) {
  const { showToast } = useToast()
  const isDetail = !!blockedSlot

  const [unitNumber, setUnitNumber] = useState(0)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (blockedSlot) {
      // 詳細モード
      const start = new Date(blockedSlot.start_time)
      const end = new Date(blockedSlot.end_time)
      setUnitNumber(blockedSlot.unit_number)
      setDate(formatDateLocal(start))
      setStartTime(formatTimeLocal(start))
      setEndTime(formatTimeLocal(end))
      setReason(blockedSlot.reason || '')
    } else {
      // 作成モード
      setUnitNumber(defaultUnitNumber ?? 0)
      setDate(defaultDate || formatDateLocal(new Date()))
      setStartTime(defaultStartTime || '09:00')
      setEndTime(defaultEndTime || '09:30')
      setReason('')
    }
  }, [isOpen, blockedSlot, defaultDate, defaultStartTime, defaultEndTime, defaultUnitNumber])

  const timeSlots = generateTimeSlots(businessHours.start, businessHours.end)

  async function handleCreate() {
    if (endTime <= startTime) {
      showToast('終了時刻は開始時刻より後にしてください', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: unitNumber,
          start_time: `${date}T${startTime}:00+09:00`,
          end_time: `${date}T${endTime}:00+09:00`,
          reason: reason || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }

      showToast('ブロック枠を作成しました', 'success')
      onSaved()
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!blockedSlot) return
    setSaving(true)
    try {
      const res = await fetch(`/api/blocked-slots?id=${blockedSlot.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'エラーが発生しました', 'error')
        return
      }
      showToast('ブロック枠を削除しました', 'success')
      onDeleted()
      onClose()
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isDetail ? 'ブロック枠の詳細' : 'ブロック枠の作成'}>
        <div className="space-y-4">
          {/* ユニット選択 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">ユニット</label>
            {isDetail ? (
              <p className="text-base text-gray-900">
                {unitNumber === 0 ? '全ユニット' : `ユニット ${unitNumber}`}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <label
                  className={`flex min-h-[44px] cursor-pointer items-center rounded-md border px-3 text-sm ${
                    unitNumber === 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="block_unit"
                    value={0}
                    checked={unitNumber === 0}
                    onChange={() => setUnitNumber(0)}
                    className="mr-2"
                  />
                  全ユニット
                </label>
                {Array.from({ length: unitCount }, (_, i) => i + 1).map((n) => (
                  <label
                    key={n}
                    className={`flex min-h-[44px] cursor-pointer items-center rounded-md border px-3 text-sm ${
                      unitNumber === n ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="block_unit"
                      value={n}
                      checked={unitNumber === n}
                      onChange={() => setUnitNumber(n)}
                      className="mr-2"
                    />
                    U{n}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 日付 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">日付</label>
            {isDetail ? (
              <p className="text-base text-gray-900">{date}</p>
            ) : (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
              />
            )}
          </div>

          {/* 開始・終了時刻 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">開始時刻</label>
              {isDetail ? (
                <p className="text-base text-gray-900">{startTime}</p>
              ) : (
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">終了時刻</label>
              {isDetail ? (
                <p className="text-base text-gray-900">{endTime}</p>
              ) : (
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 理由 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">理由</label>
            {isDetail ? (
              <p className="text-base text-gray-900">{reason || '（なし）'}</p>
            ) : (
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                placeholder="例: 昼休み、機材メンテナンス"
              />
            )}
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            {isDetail ? (
              <>
                <Button variant="secondary" onClick={onClose} className="flex-1">
                  閉じる
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1"
                  disabled={saving}
                >
                  削除
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={onClose} className="flex-1">
                  キャンセル
                </Button>
                <Button onClick={handleCreate} disabled={saving} className="flex-1">
                  {saving ? '作成中...' : 'ブロック'}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="ブロック枠の削除"
        message="このブロック枠を削除しますか？"
        confirmLabel="削除する"
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
