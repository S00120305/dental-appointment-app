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
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppointmentStatus = '予約済み' | '来院済み' | '診療中' | '帰宅済み' | 'キャンセル'

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
