-- appointments テーブルに Web予約関連カラムを追加
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_type_id uuid REFERENCES booking_types(id) NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS web_booking_status text DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_token text UNIQUE DEFAULT NULL;

-- Web予約制約の初期設定を appointment_settings に追加（App B の設定テーブル）
INSERT INTO appointment_settings (id, key, value, updated_at) VALUES
  (gen_random_uuid(), 'web_booking_min_days_ahead', '1', now()),
  (gen_random_uuid(), 'web_booking_max_days_ahead', '90', now()),
  (gen_random_uuid(), 'web_booking_deadline_time', '18:00', now()),
  (gen_random_uuid(), 'web_cancel_deadline_time', '18:00', now()),
  (gen_random_uuid(), 'web_max_active_bookings', '3', now())
ON CONFLICT (key) DO NOTHING;
