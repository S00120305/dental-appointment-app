-- 空き枠検索用: clinic_settings に診療時間のフォールバック値を追加
-- App B では appointment_settings.business_hours (JSON) を優先使用
-- clinic_settings に UNIQUE(key) 制約がない場合は手動で重複確認してから実行

INSERT INTO clinic_settings (id, key, value, updated_at)
VALUES
  (gen_random_uuid(), 'business_hours_start', '09:00', now()),
  (gen_random_uuid(), 'business_hours_end', '18:00', now())
ON CONFLICT (key) DO NOTHING;
