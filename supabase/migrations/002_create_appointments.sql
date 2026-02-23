-- =============================================
-- Step 1-2: appointments + appointment_settings テーブル作成
-- =============================================

-- 1. appointments テーブル
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  unit_number int NOT NULL,
  staff_id uuid NOT NULL REFERENCES users(id),
  start_time timestamptz NOT NULL,
  duration_minutes int NOT NULL,
  appointment_type text NOT NULL,
  status text NOT NULL DEFAULT '予約済み',
  lab_order_id uuid REFERENCES lab_orders(id),
  memo text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. appointment_settings テーブル
CREATE TABLE IF NOT EXISTS appointment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  value text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- 3. RLS（App A と同じ方式: RLS有効化のみ、ポリシーなし）
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_settings ENABLE ROW LEVEL SECURITY;

-- 4. インデックス（マスタープラン セクション5.3）
CREATE INDEX IF NOT EXISTS idx_appointments_start_unit
  ON appointments (start_time, unit_number);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_start
  ON appointments (patient_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_lab_order
  ON appointments (start_time, lab_order_id)
  WHERE lab_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_active_status
  ON appointments (status)
  WHERE status IN ('予約済み', '来院済み', '診療中');

-- 5. updated_at 自動更新トリガー
-- update_updated_at() 関数は 001_create_patients.sql で作成済み
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointment_settings_updated_at
  BEFORE UPDATE ON appointment_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. 初期設定データ
INSERT INTO appointment_settings (key, value) VALUES
  ('unit_count', '5'),
  ('business_hours', '{"start":"09:00","end":"18:00","lunch_start":"12:30","lunch_end":"14:00"}'),
  ('reminder_time', '"18:00"'),
  ('reminder_sms_template', '"【○○歯科】明日 {time} にご予約をいただいております。変更・キャンセルの場合はお電話ください。TEL: 0XX-XXXX-XXXX"'),
  ('reminder_email_template', '"【○○歯科】明日 {time} にご予約をいただいております。変更・キャンセルの場合はお電話ください。"'),
  ('closed_days', '["日","祝"]'),
  ('staff_colors', '{}'),
  ('appointment_types', '["治療","衛生士","初診","急患","メンテナンス"]')
ON CONFLICT (key) DO NOTHING;
