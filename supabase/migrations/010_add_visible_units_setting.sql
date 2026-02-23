-- 表示する診察室数の設定
INSERT INTO appointment_settings (key, value, updated_at)
VALUES ('visible_units', '4', now())
ON CONFLICT (key) DO NOTHING;
