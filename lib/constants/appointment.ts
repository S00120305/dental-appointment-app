import type { AppointmentStatus } from '@/lib/supabase/types'

// ステータス別の背景色
export const STATUS_BG: Record<string, string> = {
  '予約済み': '#e5e7eb',   // グレー
  '来院済み': '#dbeafe',   // 青
  '診療中': '#dcfce7',     // 緑
  '帰宅済み': '#f3f4f6',   // 薄グレー
  'キャンセル': '#fee2e2', // 赤
}

// ステータス別のテキスト色
export const STATUS_TEXT: Record<string, string> = {
  '予約済み': '#374151',
  '来院済み': '#1d4ed8',
  '診療中': '#15803d',
  '帰宅済み': '#9ca3af',
  'キャンセル': '#dc2626',
}

// ステータス別の Tailwind bg クラス（StatusBadge 用）
export const STATUS_BG_CLASS: Record<string, string> = {
  '予約済み': 'bg-gray-200 text-gray-700',
  '来院済み': 'bg-blue-100 text-blue-800',
  '診療中': 'bg-green-100 text-green-800',
  '帰宅済み': 'bg-gray-100 text-gray-400',
  'キャンセル': 'bg-red-100 text-red-600',
}

// ステータス遷移フロー（キャンセルは別経路）
export const STATUS_FLOW: AppointmentStatus[] = ['予約済み', '来院済み', '診療中', '帰宅済み']

export function getNextStatus(current: AppointmentStatus): AppointmentStatus | null {
  if (current === 'キャンセル') return null
  const idx = STATUS_FLOW.indexOf(current)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

export function getPrevStatus(current: AppointmentStatus): AppointmentStatus | null {
  if (current === 'キャンセル') return '予約済み'
  const idx = STATUS_FLOW.indexOf(current)
  if (idx <= 0) return null
  return STATUS_FLOW[idx - 1]
}
