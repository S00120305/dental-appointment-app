-- 予約枠ブロック機能: blocked_slots テーブル
-- 昼休み・メンテナンス等で予約を入れられない時間帯を管理

CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number INTEGER NOT NULL DEFAULT 0, -- 0 = 全ユニット
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- updated_at トリガー（既存関数を再利用）
CREATE TRIGGER set_blocked_slots_updated_at
  BEFORE UPDATE ON blocked_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- インデックス: 時間帯 + ユニットで効率的に検索
CREATE INDEX idx_blocked_slots_active
  ON blocked_slots (start_time, unit_number)
  WHERE is_deleted = false;
