-- =============================================
-- Step 1-1: patients テーブル作成
-- App B（予約・来院管理）用の患者マスタ
-- =============================================

-- 1. patients テーブル
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_number text UNIQUE,
  name text NOT NULL,
  name_kana text,
  phone text,
  email text,
  reminder_sms boolean DEFAULT false,
  reminder_email boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. RLS（App A と同じ方式: RLS有効化のみ、ポリシーなし）
-- service_role_key（API Routes）はRLSバイパス
-- anon_key（ブラウザ直接）はアクセス拒否
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- 3. インデックス
CREATE INDEX IF NOT EXISTS idx_patients_chart_number ON patients (chart_number);
CREATE INDEX IF NOT EXISTS idx_patients_name_kana ON patients (name_kana);

-- 4. updated_at 自動更新トリガー
-- update_updated_at() 関数が既に存在する場合はスキップ
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
