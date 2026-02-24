-- 予約種別マスタ（Web予約 + 院内予約共通）
CREATE TABLE IF NOT EXISTS booking_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name text NOT NULL,
  internal_name text NOT NULL,
  duration_minutes int NOT NULL,
  confirmation_mode text NOT NULL DEFAULT 'approval',
  is_web_bookable boolean DEFAULT true,
  is_token_only boolean DEFAULT false,
  description text DEFAULT '',
  notes text DEFAULT '',
  color text DEFAULT '#3B82F6',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 初期データ
INSERT INTO booking_types (display_name, internal_name, duration_minutes, confirmation_mode, is_web_bookable, is_token_only, color, sort_order) VALUES
  ('初診のご相談', '初診', 60, 'approval', true, false, '#8B5CF6', 1),
  ('定期検診・クリーニング', 'P処', 30, 'instant', true, false, '#10B981', 2),
  ('ホワイトニング相談', 'WH相談', 30, 'approval', true, false, '#F59E0B', 3),
  ('その他のご相談', '相談', 30, 'approval', true, false, '#6B7280', 4),
  ('治療の続き', '治療', 30, 'instant', false, true, '#3B82F6', 5);
