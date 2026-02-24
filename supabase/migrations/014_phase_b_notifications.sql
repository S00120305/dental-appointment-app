-- Phase B: 通知基盤 + リマインド通知
-- patients テーブルにLINE連携・通知設定カラム追加
-- notification_logs テーブル整備（既存テーブル対応）
-- line_pending_links テーブル新設

-- 1. patients テーブルにカラム追加
ALTER TABLE patients ADD COLUMN IF NOT EXISTS line_user_id text NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_notification text DEFAULT 'line';
-- CHECK制約を別途追加（ADD COLUMN IF NOT EXISTS + インライン CHECK の併用問題を回避）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_preferred_notification_check'
      AND conrelid = 'patients'::regclass
  ) THEN
    ALTER TABLE patients ADD CONSTRAINT patients_preferred_notification_check
      CHECK (preferred_notification IN ('line', 'email', 'none'));
  END IF;
END $$;

-- 2. 通知ログテーブル
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES patients(id),
  appointment_id uuid REFERENCES appointments(id) NULL,
  channel text NOT NULL CHECK (channel IN ('line', 'email')),
  type text NOT NULL CHECK (type IN (
    'reminder',
    'booking_confirm',
    'booking_change',
    'booking_cancel',
    'approval_result',
    'token_sent'
  )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  content text,
  error_message text NULL,
  created_at timestamptz DEFAULT now()
);

-- 既存テーブルに sent_at があり created_at がない場合 → リネーム
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'sent_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE notification_logs RENAME COLUMN sent_at TO created_at;
  END IF;
END $$;

-- 既存テーブルに不足カラムがあれば追加
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email';
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS content text NULL;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error_message text NULL;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- インデックス
CREATE INDEX IF NOT EXISTS idx_notification_logs_patient ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- 3. LINE仮紐付けテーブル
CREATE TABLE IF NOT EXISTS line_pending_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id text UNIQUE NOT NULL,
  line_display_name text NULL,
  created_at timestamptz DEFAULT now()
);
