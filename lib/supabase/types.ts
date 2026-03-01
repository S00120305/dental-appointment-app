// DB型定義プレースホルダー
// TODO: Supabaseのテーブル作成後に型を定義する

export type PreferredNotification = 'line' | 'email' | 'none'

export type Patient = {
  id: string
  chart_number: string
  last_name: string
  first_name: string
  last_name_kana: string | null
  first_name_kana: string | null
  phone: string | null
  email: string | null
  reminder_sms: boolean
  reminder_email: boolean
  line_user_id: string | null
  preferred_notification: PreferredNotification
  is_vip: boolean
  caution_level: number // 0=なし, 1=注意①, 2=注意②, 3=注意③
  is_infection_alert: boolean
  gender: string | null
  date_of_birth: string | null
  postal_code: string | null
  address: string | null
  birth_date: string | null
  memo: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'pending' | 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'

export type Appointment = {
  id: string
  patient_id: string
  unit_number: number
  staff_id: string
  start_time: string
  duration_minutes: number
  appointment_type: string
  status: AppointmentStatus
  lab_order_id: string | null
  booking_type_id: string | null
  slide_from_id: string | null
  web_booking_status: string | null
  booking_token: string | null
  booking_source: string
  memo: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type AppointmentSetting = {
  id: string
  key: string
  value: string
  updated_at: string
  updated_by: string
}

// 技工物（App A 管理、App B は読み取りのみ）
export type LabOrderStatus = '未発注' | '製作中' | '納品済み' | 'セット完了' | 'キャンセル'

export type LabOrder = {
  id: string
  patient_id: string // カルテNo（テキスト型）
  lab_id: string | null
  item_type: string | null
  tooth_info: string | null
  status: LabOrderStatus
  due_date: string | null
  set_date: string | null
  memo: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

// 技工物 + ラボ名（JOIN済み）
export type LabOrderWithLab = LabOrder & {
  lab?: { id: string; name: string } | null
}

// スライド予約の参照データ
export type SlideRef = {
  id: string
  unit_number: number
  appointment_type: string
  start_time: string
  duration_minutes: number
  staff: { id: string; name: string } | null
}

// JOIN済みの予約データ（API レスポンス用）
export type AppointmentWithRelations = Appointment & {
  patient: Pick<Patient, 'id' | 'chart_number' | 'last_name' | 'first_name' | 'last_name_kana' | 'first_name_kana' | 'phone' | 'is_vip' | 'caution_level' | 'is_infection_alert'> | null
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
  booking_type?: {
    id: string
    display_name: string
    internal_name: string
    color: string
    category: string | null
  } | null
  tags?: { id: string; name: string; icon: string | null; color: string | null }[]
  slide_from?: SlideRef | null
  slide_to?: SlideRef | null // フロント側で計算
}

// 予約種別マスタ
export type UnitType = 'hygienist' | 'doctor' | 'any'

export type BookingType = {
  id: string
  display_name: string
  internal_name: string
  duration_minutes: number
  confirmation_mode: 'instant' | 'approval'
  is_web_bookable: boolean
  is_token_only: boolean
  description: string
  notes: string
  color: string
  category: string | null
  unit_type: UnitType
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// 予約種別カテゴリ定数
export const BOOKING_CATEGORIES = [
  { name: '診察', color: '#6B7280' },
  { name: 'C処置', color: '#10B981' },
  { name: '根治', color: '#92400E' },
  { name: 'DH・衛生士', color: '#3B82F6' },
  { name: '歯周病', color: '#EC4899' },
  { name: 'CrBr・補綴', color: '#8B5CF6' },
  { name: 'デンチャー・義歯', color: '#D97706' },
  { name: '手術', color: '#EF4444' },
  { name: 'インプラント', color: '#047857' },
  { name: '矯正', color: '#EAB308' },
  { name: 'その他', color: '#9CA3AF' },
] as const

// 予約注意事項タグ
export type AppointmentTag = {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// 予約枠ブロック
export type BlockedSlot = {
  id: string
  unit_number: number // 0 = 全ユニット
  start_time: string
  end_time: string
  reason: string | null
  is_recurring: boolean
  created_by: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

// スタッフ（users テーブルから取得）
export type Staff = {
  id: string
  name: string
  is_active: boolean
  is_admin: boolean
  sort_order: number | null
  color: string | null
}

// 通知ログ
export type NotificationLog = {
  id: string
  patient_id: string
  appointment_id: string | null
  channel: 'line' | 'email'
  type: 'reminder' | 'booking_confirm' | 'booking_change' | 'booking_cancel' | 'approval_result' | 'token_sent'
  status: 'pending' | 'sent' | 'failed'
  content: string | null
  error_message: string | null
  created_at: string
}

// LINE仮紐付け
export type LinePendingLink = {
  id: string
  line_user_id: string
  line_display_name: string | null
  created_at: string
}

// バックアップリクエスト
export type BackupRequest = {
  id: string
  request_type: string
  backup_type: string
  status: string
  requested_by: string | null
  started_at: string | null
  completed_at: string | null
  file_size_mb: number | null
  error_message: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

// 操作ログ
export type AppointmentLog = {
  id: string
  user_id: string | null
  user_name: string | null
  action_type: string
  target_type: string
  target_id: string | null
  summary: string
  details: Record<string, unknown>
  created_at: string
}
