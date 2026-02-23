# 歯科医院 予約・来院管理アプリ（App B）

## 技術スタック
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Supabase Pro (PostgreSQL, Realtime)
- bcrypt（パスワード/PINハッシュ化）
- FullCalendar 6.x (Resource TimeGrid View)
- Twilio（SMS通知）/ Resend（メール通知）
- SWR（データフェッチ + キャッシュ）
- @ducanh2912/next-pwa（PWA対応）
- Vercel Pro デプロイ

## アーキテクチャ方針
- 認証: 二段階（マスターパスワード → PIN）。staff専用（外部ポータルなし）
- DB操作: 全てAPI Routes経由（service_role_key使用）。クライアント直接アクセス禁止
- 削除: 全テーブル論理削除（is_deleted / is_active）。物理削除は行わない
- Realtime: Supabase Realtime で予約ステータス・技工物ステータスを全端末同期
- 楽観的UI更新: ボタン押下即座にUI反映、失敗時のみロールバック
- FullCalendarはdynamic importでバンドル最適化（SSR無効）
- ビルド: `next build --webpack`（PWAのService Worker生成にwebpack必要）

## 共有DB（App A と同じ Supabase プロジェクト）
- App B 専用テーブル: patients, appointments, appointment_settings, notification_logs
- App A 管理テーブル（読み取りのみ）: lab_orders, labs, items, suppliers
- 共有テーブル: clinic_settings, users
- 不要テーブル: transactions, order_checks, maintenance_items, maintenance_logs

## App A との関係
- App A: 在庫・技工物管理（app.oralcare-kanazawa.clinic）
- App B: 予約・来院管理（appo.oralcare-kanazawa.clinic）
- 同じ Supabase DB を共有。App B は lab_orders を読み取りのみで参照
- 技工物連動: appointments.lab_order_id → lab_orders.id
- lab_orders.patient_id はテキスト型のカルテNo。patients.chart_number と照合する
- lab_orders.memo は追記方式（[日付 名前 → ステータス] 形式）を尊重
- 技工物ステータス: 未発注 → 製作中 → 納品済み → セット完了 / キャンセル

## 画面構成
マスターPW → PIN → ダッシュボード → カレンダー / 患者管理 / 設定

## 重要な制約
- iPadタッチ操作最適化（ボタン最低44x44px）
- PINは5回失敗で5分ロック
- セッションは30分無操作でタイムアウト
- 予約カレンダーは楽観的UI更新でレスポンス速度を最優先
- lab_orders テーブルへの書き込みは禁止（App A が管理）
- オプテック（レセコン）はCSVエクスポートのみ連携

## 共有DB開発の鉄則
- 新規テーブル追加: 安全
- 既存テーブルへの NULL許容カラム追加: 注意して実施
- 既存テーブルのカラム名変更/削除/RLS変更: 禁止
