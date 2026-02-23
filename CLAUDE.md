# 歯科医院 予約・来院管理アプリ（App B）

## 技術スタック
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- Supabase Pro（既存の在庫・技工物管理アプリ App A とDB共有）
- Supabase Realtime（予約ステータス + 技工物ステータスの全端末同期）
- FullCalendar（Resource Timeline View）— Step 1-3 でインストール予定
- bcrypt（パスワード/PINハッシュ化）
- Twilio（SMS通知）/ Resend（メール通知）
- Vercel Pro デプロイ

## アーキテクチャ方針
- 別アプリとして独立（別リポジトリ、別Vercelプロジェクト）
- 同じSupabase DBを共有し、技工物連動を実現
- 認証: 二段階（マスターパスワード → PIN）。staff専用、外部ポータル認証は不要
- DB操作: 全てAPI Routes経由（service_role_key使用）
- 楽観的UI更新でレスポンス速度を最優先
- Supabase Realtimeで複数端末リアルタイム同期
- 削除: 全テーブル論理削除（is_deleted / is_active）

## ドメイン構成
- app.oralcare-kanazawa.clinic → App A（在庫・技工物管理）
- appo.oralcare-kanazawa.clinic → App B（予約・来院管理、本アプリ）

## DB テーブル（本アプリで新規作成）
patients, appointments, appointment_settings

## DB テーブル（既存・共有参照）
clinic_settings, users, labs, lab_orders, items, suppliers, categories

## DB テーブル（存在するがApp Bからは不要）
transactions, order_checks, maintenance_items, maintenance_logs

## App A（v4.0）との差分で注意すべき点
- 技工物ステータスに「出荷済み」が存在する（製作中と納品済みの間）
- lab_orders.memo は追記方式（[日付 名前 → ステータス] 形式）
- items.supplier_id は suppliers テーブルへのFK（旧 supplier_name は残存）
- App A には外部ポータル（/portal/vendor, /portal/lab）が存在するが、App B は staff 専用
- maintenance_items, maintenance_logs テーブルが存在するが App B からは不要
- lab_orders.patient_id はテキスト型のカルテNo。patients.chart_number と照合する

## 画面構成
マスターPW → PIN → ダッシュボード → カレンダー / 患者管理 / 設定

## 重要な制約
- iPadタッチ操作最適化（ボタン最低44x44px）
- PINは5回失敗で5分ロック
- セッションは30分無操作でタイムアウト
- カレンダーは楽観的UI更新 + Realtimeで即時反映
- FullCalendarはdynamic importでバンドル最適化
- 技工物連動が最大の差別化ポイント（共有DBで実現）
- lab_orders は読み取りのみ。App B からは書き込まない
- オプテック（レセコン）はCSVエクスポートのみ連携
- 共有テーブルのカラム変更・削除・RLS変更は禁止

## 共有DB開発の鉄則
- 新規テーブル追加: ✅ 安全
- 既存テーブルへの NULL許容カラム追加: ⚠️ 注意
- 既存テーブルのカラム名変更/削除/RLS変更: ❌ 禁止
