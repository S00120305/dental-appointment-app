-- Phase C-2: Web予約バックエンド基盤

-- booking_source カラム追加（内部予約 or Web予約の識別）
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'internal';

-- clinic_phone を clinic_settings に追加（共有テーブル、NULL許容INSERT）
INSERT INTO clinic_settings (key, value)
VALUES ('clinic_phone', '')
ON CONFLICT (key) DO NOTHING;
