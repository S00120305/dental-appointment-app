-- 患者属性タグ: patients テーブルにカラム追加
-- VIP / 注意レベル(排他的 0-3) / 感染注意

ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS caution_level int DEFAULT 0;
  -- 0=なし, 1=注意①, 2=注意②, 3=注意③
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_infection_alert boolean DEFAULT false;
