-- 患者詳細パネル用カラム追加
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date date NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS memo text DEFAULT '';
