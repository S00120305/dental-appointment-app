-- 操作ログテーブル（App B 専用）
-- ログは削除不可（is_deleted なし）
CREATE TABLE IF NOT EXISTS appointment_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_name text,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  summary text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_logs_created_at ON appointment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_logs_target ON appointment_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_appointment_logs_user ON appointment_logs(user_id);
