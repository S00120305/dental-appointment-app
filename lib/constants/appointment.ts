import type { AppointmentStatus } from '@/lib/supabase/types'

// ステータス表示ラベル（内部値 → 画面表示）
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: '未来院',
  checked_in: '受付済み',
  completed: '治療済み',
  cancelled: 'キャンセル',
  no_show: '無断キャンセル',
}

// ステータス別の背景色（カレンダーイベント用）
export const STATUS_BG: Record<string, string> = {
  scheduled: '#e5e7eb',   // グレー
  checked_in: '#dbeafe',  // 青
  completed: '#f3f4f6',   // 薄グレー
  cancelled: '#fee2e2',   // 赤
  no_show: '#fef3c7',     // 黄
}

// ステータス別のテキスト色（カレンダーイベント用）
export const STATUS_TEXT: Record<string, string> = {
  scheduled: '#374151',
  checked_in: '#1d4ed8',
  completed: '#9ca3af',
  cancelled: '#dc2626',
  no_show: '#d97706',
}

// ステータス別の Tailwind bg クラス（StatusBadge 用）
export const STATUS_BG_CLASS: Record<string, string> = {
  scheduled: 'bg-gray-200 text-gray-700',
  checked_in: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-yellow-100 text-yellow-700',
}

// ステータスアイコン（カレンダー予約ブロック用）
export const STATUS_ICON: Record<AppointmentStatus, string> = {
  scheduled: '\u25CB',      // ○
  checked_in: '\u2705',     // ✅
  completed: '\u2705\u2705', // ✅✅
  cancelled: '\u2715',      // ✕
  no_show: '\u2715',        // ✕
}

// ステータスアイコンの色（カレンダー予約ブロック用）
export const STATUS_ICON_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#9ca3af',  // グレー
  checked_in: '#2563eb', // 青
  completed: '#16a34a',  // 緑
  cancelled: '#dc2626',  // 赤
  no_show: '#dc2626',    // 赤
}

// ステータス別左ボーダー色（カレンダー予約ブロック用）
export const STATUS_BORDER_COLOR: Record<string, string> = {
  scheduled: '#d1d5db',  // グレー
  checked_in: '#3b82f6', // 青
  completed: '#22c55e',  // 緑
  cancelled: '#f87171',  // 赤
  no_show: '#fbbf24',    // 黄
}

// ステータス遷移フロー（メインフロー: scheduled → checked_in → completed）
export const STATUS_FLOW: AppointmentStatus[] = ['scheduled', 'checked_in', 'completed']

export function getNextStatus(current: AppointmentStatus): AppointmentStatus | null {
  if (current === 'cancelled' || current === 'no_show') return null
  const idx = STATUS_FLOW.indexOf(current)
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

export function getPrevStatus(current: AppointmentStatus): AppointmentStatus | null {
  if (current === 'cancelled' || current === 'no_show') return 'scheduled'
  const idx = STATUS_FLOW.indexOf(current)
  if (idx <= 0) return null
  return STATUS_FLOW[idx - 1]
}
