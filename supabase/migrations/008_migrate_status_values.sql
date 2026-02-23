-- 予約ステータスを日本語から英語に移行
-- 旧: 予約済み, 来院済み, 診療中, 帰宅済み, キャンセル
-- 新: scheduled, checked_in, completed, cancelled, no_show

-- 既存データの変換
UPDATE appointments SET status = 'scheduled'  WHERE status = '予約済み';
UPDATE appointments SET status = 'checked_in'  WHERE status = '来院済み';
UPDATE appointments SET status = 'completed'   WHERE status = '診療中';
UPDATE appointments SET status = 'completed'   WHERE status = '帰宅済み';
UPDATE appointments SET status = 'cancelled'   WHERE status = 'キャンセル';

-- ※ 診療中・帰宅済み は両方とも completed に統合
-- ※ no_show は新しいステータス（既存データには存在しない）
