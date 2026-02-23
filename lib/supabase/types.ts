// DB型定義プレースホルダー
// TODO: Supabaseのテーブル作成後に型を定義する

export type Patient = {
  id: string
  chart_number: string
  name: string
  name_kana: string | null
  phone: string | null
  email: string | null
  reminder_sms: boolean
  reminder_email: boolean
  is_vip: boolean
  caution_level: number // 0=なし, 1=注意①, 2=注意②, 3=注意③
  is_infection_alert: boolean
  birth_date: string | null
  memo: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'

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

// JOIN済みの予約データ（API レスポンス用）
export type AppointmentWithRelations = Appointment & {
  patient: Pick<Patient, 'id' | 'chart_number' | 'name' | 'name_kana' | 'is_vip' | 'caution_level' | 'is_infection_alert'> | null
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
}
