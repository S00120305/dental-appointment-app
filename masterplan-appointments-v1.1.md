# 🦷 歯科医院 予約・来院管理アプリ — マスタープラン v1.1

最終更新: 2026年2月

-----

## 1. プロジェクト概要

### 1.1 目的

既存の院内業務管理アプリ（在庫・発注管理 + 技工物管理）と **同じSupabase DBを共有する独立アプリ** として、予約・来院管理システムを構築する。技工物との連動を最大の差別化ポイントとし、「患者が来院してから技工物が届いていないことに気づく」という事態を防ぐ。

### 1.2 アーキテクチャ

```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  在庫・技工物管理アプリ（App A）  │    │  予約・来院管理アプリ（App B）    │
│  (既存 Phase 1 & 2)           │    │  (本アプリ・新規)                │
│  Vercel App A                 │    │  Vercel App B                 │
│  app.oralcare-kanazawa.clinic │    │  appo.oralcare-kanazawa.clinic│
└──────────────┬───────────────┘    └──────────────┬───────────────┘
               │                                    │
               └──────────────┬─────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │   Supabase Pro    │
                    │   (共有DB)         │
                    │                   │
                    │  ◆ 既存テーブル      │
                    │  clinic_settings  │
                    │  users            │
                    │  labs             │
                    │  lab_orders       │
                    │  items            │
                    │  categories       │
                    │  suppliers        │
                    │  transactions     │
                    │  order_checks     │
                    │  maintenance_items│
                    │  maintenance_logs │
                    │                   │
                    │  ◆ 新規テーブル      │
                    │  patients         │
                    │  appointments     │
                    │  appointment_     │
                    │    settings       │
                    └──────────────────┘
```

### 1.3 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js 14+ (App Router), React 18+, TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド/DB | Supabase Pro（既存プロジェクトを共有） |
| カレンダーUI | FullCalendar（Resource Timeline View） |
| リアルタイム同期 | Supabase Realtime |
| パスワードハッシュ | bcrypt |
| デプロイ | Vercel Pro |
| PWA | next-pwa |
| SMS通知 | Twilio |
| メール通知 | Resend |

### 1.4 ドメイン構成

| URL | 用途 |
|-----|------|
| `oralcare-kanazawa.clinic` | 医院ホームページ |
| `app.oralcare-kanazawa.clinic` | 在庫・技工物管理アプリ（App A） |
| `appo.oralcare-kanazawa.clinic` | 予約・来院管理アプリ（App B・本アプリ） |

- 各アプリは独立したVercelプロジェクト
- Cookieは別サブドメインのため独立（マスターPWは各アプリで1回ずつ入力、30日間保持）
- iPadホーム画面にPWAアイコンが2つ並ぶ運用

### 1.5 追加ランニングコスト

| 項目 | 費用 |
|------|------|
| Vercel Pro（2つ目のアプリ） | 追加費用なし（Proプランはチーム単位、複数プロジェクト可） |
| Twilio SMS | 約2〜3円/通（1日40件で月約1,200〜3,600円） |
| Resend メール | 月3,000通まで無料 |
| Supabase | 追加費用なし（既存Proプランを共有） |

-----

## 2. 既存アプリ（App A v4.0）との関係

### 2.1 共有するもの

| 対象 | 詳細 |
|------|------|
| Supabase DB | 同じプロジェクト・同じPostgreSQLインスタンス |
| 認証テーブル | `clinic_settings`（マスターPW）、`users`（スタッフPIN） |
| 技工物テーブル | `lab_orders`（予約との紐付け用に参照） |
| ラボテーブル | `labs`（技工物情報の表示用） |
| 認証方式 | マスターパスワード → PIN の二段階認証（同じ仕組みを独立実装） |

### 2.2 独立するもの

| 対象 | 詳細 |
|------|------|
| Next.js プロジェクト | 別リポジトリ |
| Vercel デプロイ | 別プロジェクト（`appo.oralcare-kanazawa.clinic`） |
| ナビゲーション | 予約アプリ専用のシンプルなナビ |
| PWA | 別のホーム画面アイコン（カレンダーモチーフ） |
| 認証コード | App Aからコピーして独立管理（共通ライブラリ化はしない） |

### 2.3 App A v4.0 で変わった点（v1.0 → v1.1 での追記）

App A がv4.0改善を経て、マスタープランv1.0作成時から変更されている箇所がある。App Bの開発においてこれらを認識しておく必要がある。

#### ① 技工物ステータスの変更

```
v1.0の想定:  未発注 → 製作中 → 納品済み → セット完了 / キャンセル
App A の現状: 未発注 → 製作中 → 出荷済み → 納品済み → セット完了 / キャンセル
                                 ^^^^^^^^
                                 v4.0で追加
```

**App Bへの影響:**
- カレンダーの技工物バッジに「出荷済み」の表示が必要
- ダッシュボードのアラートにも「出荷済み」を含める

#### ② lab_orders.memo の形式

```
v1.0の想定: 単純なテキスト
App A の現状: 追記方式（[日付 名前 → ステータス] 形式で改行追記）
```

**App Bへの影響:**
- 患者詳細画面の技工物履歴でmemoを表示する際、このフォーマットを尊重して表示
- App Bからはmemoへの書き込みは不要（読み取りのみ）

#### ③ 仕入先のテーブル構造

```
v1.0の想定: items.supplier_name（テキスト）
App A の現状: suppliers テーブル + items.supplier_id（FK）
```

**App Bへの影響:**
- ダッシュボードの在庫アラートはタップでApp Aに遷移するだけなので影響なし

#### ④ 外部ポータルの存在

```
v1.0の想定: なし
App A の現状: /portal/vendor（業者）、/portal/lab（技工所）が存在
             認証APIで staff/vendor/lab の振り分けを行っている
```

**App Bへの影響:**
- App Bの認証は **staff専用** にする。外部ポータル認証は不要
- App Aの `api/auth/external/route.ts` は移植しない

#### ⑤ メンテナンス管理テーブルの存在

```
v1.0の想定: なし
App A の現状: maintenance_items, maintenance_logs テーブルが存在
```

**App Bへの影響:**
- App Bからは参照不要。存在を無視してよい

### 2.4 アプリ間導線

- App B のダッシュボードまたはヘッダーに「在庫管理アプリへ」のリンク（`app.oralcare-kanazawa.clinic`、target="_blank"）
- App A のダッシュボードにも「予約管理アプリへ」のリンク（`appo.oralcare-kanazawa.clinic`、target="_blank"）

### 2.5 共有DB開発の鉄則

| 操作 | 安全性 | 説明 |
|------|--------|------|
| 新規テーブル追加 | ✅ 安全 | patients, appointments, appointment_settings |
| 既存テーブルへの NULL許容カラム追加 | ⚠️ 注意 | App Aに影響しないが確認は必要 |
| 既存テーブルの FK 追加 | ⚠️ 注意 | appointments.lab_order_id → lab_orders.id は安全（NULL許容FK） |
| 既存テーブルのカラム名変更 | ❌ 禁止 | App A が壊れる |
| 既存テーブルのカラム削除 | ❌ 禁止 | App A が壊れる |
| 既存テーブルの NOT NULL カラム追加 | ❌ 禁止 | App A の INSERT が失敗する |
| 既存テーブルの RLS 変更 | ❌ 禁止 | 両アプリに影響 |

**各Stepの完了後に必ず実行するチェック:**
- App B の新機能が動作するか
- App A（`app.oralcare-kanazawa.clinic`）が正常に動作するか
- 共有テーブルに意図しない変更がないか

-----

## 3. オプテック（レセコン）との役割分担

### 3.1 基本方針

| システム | 用途 |
|----------|------|
| オプテック（レセコン） | 保険請求専用。患者情報CSVエクスポートのみ連携 |
| 本アプリ | 予約管理・来院管理を担当。技工物管理アプリと共有DBで連動 |

### 3.2 初診患者フロー

```
オプテックで患者登録（保険証・基本情報）
    ↓
CSVエクスポート → 本アプリにインポート（または手動登録）
    ↓
以降の予約管理は本アプリで完結
```

### 3.3 デバイス別の使い方

| デバイス | 主な用途 |
|----------|----------|
| iPad（チェアサイド） | ユニット別カレンダー確認、来院ステータス更新、次回予約入力 |
| PC（受付） | 予約の新規作成・変更・キャンセル、週間カレンダー俯瞰、患者管理 |

-----

## 4. 機能仕様

### 4.1 予約カレンダー（最重要機能）

オプテックの画面が見にくく使いにくいことが自作する最大の動機。

| 項目 | 仕様 |
|------|------|
| 表示軸 | 縦：時間、横：ユニット番号 |
| 時間グリッド | 10分グリッド、予約の長さは5分単位で設定可 |
| ユニット数 | 最大8台（初期4〜5台。設定画面から変更可） |
| 表示切り替え | 全ユニット / 特定ユニットのみ（タブ切り替え） |
| 日表示・週表示 | 切り替え対応 |
| 色分け | 担当スタッフ別の色分け |
| ライブラリ | FullCalendar（Resource Timeline View） |
| ドラッグ&ドロップ | 予約の時間帯・ユニット移動（PC・iPad両対応） |

**表示イメージ（ユニット別横並び）:**

```
        ユニット1        ユニット2        ユニット3
 9:00  [田中 太郎]      [佐藤 花子]
       Dr.A担当         衛生士B担当
       🦷インレーSET
       ✅納品済み

10:00  [鈴木 一郎]
       定期検診 60分

14:00                                  [山田 次郎]
                                        🦷クラウンSET
                                        ⚠️未納品！
```

#### カレンダーの操作仕様

| 操作 | 動作 |
|------|------|
| 空きスロットタップ | 新規予約作成（日時・ユニット自動入力） |
| 予約ブロックタップ | 予約詳細モーダル表示（編集・ステータス更新・キャンセル） |
| 予約ブロック長押し→ドラッグ | 時間帯変更 / ユニット移動 |
| ピンチ操作（iPad） | 時間軸のズームイン/アウト |
| 左右スワイプ | 日付の前後移動 |

### 4.2 来院ステータス管理

受付とチェアサイドの両方からタップ一つでステータス更新。Supabase Realtimeにより全端末にリアルタイム反映。

| ステータス | 説明 | 表示色 |
|------------|------|--------|
| 予約済み | 予約が入っている状態 | グレー |
| 来院済み | 患者が来院した（受付でタップ） | 青 |
| 診療中 | チェアに案内された | 緑 |
| 帰宅済み | 会計・帰宅完了 | 薄グレー |
| キャンセル | 当日キャンセル | 赤 |

**ステータス遷移:**

```
予約済み → 来院済み → 診療中 → 帰宅済み
                              ↗
予約済み → キャンセル
```

- ステータスはワンタップで次の状態に進む（逆戻しも可能）
- カレンダー上の予約ブロックの色がリアルタイムで変化

### 4.3 技工物との連動（最大の差別化ポイント）

既存のどの予約管理ソフトにもない機能。予約と技工物を紐付け、当日朝のダッシュボードで「今日セット予定の技工物が全部届いているか」を一目で確認。

#### カレンダー上の技工物バッジ（v1.1 更新: 出荷済みを含む）

- 技工物セット予約には 🦷 アイコンを表示
- 「納品済み」→ ✅ 緑「セット準備OK」
- 「出荷済み」→ 🚚 青「本日届く予定」 ← **v1.1追加**
- 「製作中」→ ⚠️ 黄「製作中」
- 「未発注」→ ❌ 赤「未発注！」

#### ダッシュボード統合アラート

```
📅 本日のセット予定
────────────────────────────
10:00 田中 太郎さん（ユニット1）
      インレー（右上6番）— ○○デンタルラボ
      ✅ 納品済み・セット準備OK

14:00 山田 次郎さん（ユニット3）
      クラウン（左下6番）— △△技工所
      ⚠️ まだラボから届いていません！
────────────────────────────
```

#### 紐付け方法

- 新規予約作成時に「技工物セット」トグルをONにすると、患者に紐づく未セットの技工物一覧が表示される
- 取得条件: `lab_orders WHERE patient_id = 患者のchart_number AND status IN ('製作中', '出荷済み', '納品済み') AND is_deleted = false`
- 該当する技工物を選択して紐付け（`appointments.lab_order_id`）
- App A側で `lab_orders` のステータスが更新されると、カレンダー上の表示も自動で反映（共有DB + Realtime）

#### lab_ordersとpatientsの紐付け（v1.1 明記）

```
lab_orders.patient_id = patients.chart_number（カルテNo文字列で照合）
```

※ `lab_orders.patient_id` はテキスト型のカルテNoであり、`patients.id`（UUID）ではない点に注意。

### 4.4 ダッシュボード

本アプリの初期画面。予約中心だが、技工物アラートも共有DBから表示。

#### 予約関連

| セクション | 内容 |
|------------|------|
| 本日の予約サマリー | 総予約数、来院済み/未来院の内訳、空きユニット数 |
| 次の予約 | 直近の未来院予約（患者名・時間・ユニット） |
| 本日のタイムライン | 全ユニットの簡易タイムライン（ダッシュボードからカレンダーへの導線） |

#### 技工物連動（共有DB参照）

| セクション | 内容 | バッジ色 |
|------------|------|----------|
| 本日セット予定 | 今日の予約で技工物セットする件数と納品状況 | 赤 |
| 明日セット予定 | 明日の予約で技工物セットする件数 | オレンジ |
| 納品遅延 | `due_date` を過ぎた未納品の技工物（status IN ('製作中', '出荷済み')） | 赤ハイライト |

#### 在庫アラート（共有DB参照）

| セクション | 内容 |
|------------|------|
| 発注アラート | 在庫 ≤ 発注点のアイテム数（タップで `app.oralcare-kanazawa.clinic` に遷移） |

### 4.5 患者管理

| 機能 | 詳細 |
|------|------|
| 患者一覧 | カルテNo / 氏名 / フリガナで検索・絞り込み |
| 患者登録 | 手動登録（カルテNo、氏名、フリガナ、電話番号、メール） |
| CSVインポート | オプテックからのCSV取り込み |
| 患者詳細 | 予約履歴、技工物履歴（共有DB参照）、リマインド設定 |
| リマインド設定 | 患者ごとにSMS/メール/不要を選択 |

**技工物履歴の表示について（v1.1 追記）:**
- `lab_orders.memo` は追記方式（`[日付 名前 → ステータス]` 形式で改行追記）
- この形式を尊重して表示する（改行をそのまま保持）
- App B からは `lab_orders` への書き込みは行わない（読み取りのみ）

### 4.6 リマインド通知（SMS/メール）

| 項目 | 仕様 |
|------|------|
| SMS | Twilio使用 |
| メール | Resend使用（月3,000通まで無料） |
| 通知タイミング | 前日の指定時刻（デフォルト18:00、設定画面から変更可） |
| 患者別設定 | SMS希望 / メール希望 / 不要を個別フラグで管理 |
| テンプレート | 設定画面からカスタマイズ可能 |

**テンプレート例:**

```
【○○歯科】
明日 10:00 にご予約をいただいております。
変更・キャンセルの場合はお電話ください。
TEL: 0XX-XXXX-XXXX
```

**実装構成:**

```
Supabase Edge Functions（cron: 毎日指定時刻に実行）
└── 翌日のappointmentsを取得
    ├── patient.reminder_sms = true → Twilio SMS送信
    └── patient.reminder_email = true → Resend メール送信
```

### 4.7 設定画面

| 項目 | 詳細 |
|------|------|
| ユニット数設定 | 稼働ユニット数の変更（1〜8） |
| 診療時間設定 | カレンダーの表示開始/終了時刻、昼休み帯 |
| リマインド設定 | 通知テンプレート、送信時刻、送信元番号/アドレス |
| スタッフ色設定 | 各スタッフのカレンダー表示色 |
| 予約種別管理 | 治療/衛生士/初診 等のカスタム種別追加・編集 |
| 休診日設定 | カレンダーの休診日表示（祝日＋任意設定） |
| マスターパスワード変更 | 既存と同じ仕組み |
| スタッフ管理 | 既存と同じ仕組み（共有usersテーブル） |

-----

## 5. データベース設計

### 5.1 新規テーブル

#### `patients`（患者マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid, PK | |
| chart_number | text, UNIQUE | カルテNo（オプテックとの紐付けキー） |
| name | text, NOT NULL | 患者氏名 |
| name_kana | text, NULL | フリガナ |
| phone | text, NULL | 電話番号 |
| email | text, NULL | メールアドレス（リマインド用） |
| reminder_sms | boolean, DEFAULT false | SMS通知希望フラグ |
| reminder_email | boolean, DEFAULT false | メール通知希望フラグ |
| is_active | boolean, DEFAULT true | 在籍フラグ（論理削除） |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `appointments`（予約）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid, PK | |
| patient_id | uuid, FK → patients | 患者FK |
| unit_number | int, NOT NULL | ユニット番号（1〜8） |
| staff_id | uuid, FK → users | 担当スタッフFK |
| start_time | timestamptz, NOT NULL | 予約開始日時 |
| duration_minutes | int, NOT NULL | 予約時間（分、5分単位） |
| appointment_type | text, NOT NULL | 種別（治療 / 衛生士 / 初診 等） |
| status | text, NOT NULL, DEFAULT '予約済み' | 来院ステータス |
| lab_order_id | uuid, FK → lab_orders, NULL | 技工物FK（セット予約の場合） |
| memo | text, NULL | 備考 |
| is_deleted | boolean, DEFAULT false | 論理削除フラグ |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`status` の値定義:**

| 値 | 説明 |
|----|------|
| `予約済み` | 予約が入っている状態 |
| `来院済み` | 患者が来院した |
| `診療中` | チェアに案内された |
| `帰宅済み` | 会計・帰宅完了 |
| `キャンセル` | キャンセル |

#### `appointment_settings`（予約設定）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid, PK | |
| key | text, UNIQUE | 設定キー |
| value | text | 設定値（JSON文字列） |
| updated_at | timestamptz | |
| updated_by | uuid, FK → users | |

**設定キー例:**

| key | value例 | 説明 |
|-----|---------|------|
| `unit_count` | `5` | 稼働ユニット数 |
| `business_hours` | `{"start":"09:00","end":"18:00","lunch_start":"12:30","lunch_end":"14:00"}` | 診療時間 |
| `reminder_time` | `"18:00"` | リマインド送信時刻 |
| `reminder_sms_template` | テンプレート文 | SMS通知テンプレート |
| `reminder_email_template` | テンプレート文 | メール通知テンプレート |
| `closed_days` | `["日","祝"]` | 定休曜日 |
| `staff_colors` | `{"user_id":"#3B82F6",...}` | スタッフ別カレンダー色 |
| `appointment_types` | `["治療","衛生士","初診","急患"]` | 予約種別リスト |

### 5.2 既存テーブルとの紐付け

```
patients.chart_number  ←→  lab_orders.patient_id（カルテNo文字列で連結）
appointments.lab_order_id  →  lab_orders.id（技工物との直接FK）
appointments.patient_id    →  patients.id
appointments.staff_id      →  users.id（既存スタッフテーブル共有）
```

### 5.3 インデックス設計

| テーブル | インデックス | 用途 |
|----------|------------|------|
| appointments | `(start_time, unit_number)` | カレンダー表示の高速化 |
| appointments | `(patient_id, start_time)` | 患者別予約履歴 |
| appointments | `(start_time, lab_order_id)` WHERE lab_order_id IS NOT NULL | 技工物セット予約の検索 |
| appointments | `(status)` WHERE status IN ('予約済み','来院済み','診療中') | 当日アクティブ予約の取得 |
| patients | `(chart_number)` | カルテNo検索 |
| patients | `(name_kana)` | フリガナ検索 |

-----

## 6. レスポンス速度設計（重要）

予約管理は操作のストレスが業務効率に直結するため、レスポンス速度を最優先で設計する。

### 6.1 楽観的UI更新（Optimistic Updates）

| 操作 | 動作 |
|------|------|
| ステータス更新 | タップ即座にUI反映 → バックグラウンドでDB更新 → 失敗時のみロールバック |
| 予約の移動 | ドラッグ完了即座にUI反映 → バックグラウンドでDB更新 |
| 新規予約作成 | モーダル閉じた瞬間にカレンダーに反映 |

### 6.2 Supabase Realtime

```
┌──────────┐         ┌──────────┐
│ 受付PC    │         │ iPad     │
│ (App B)  │         │ (App B)  │
└────┬─────┘         └────┬─────┘
     │                     │
     │   Supabase Realtime  │
     │   appointments変更を   │
     │   全クライアントに配信    │
     │         ▲            │
     └─────────┴────────────┘
```

- `appointments` テーブルの INSERT / UPDATE / DELETE をサブスクライブ
- `lab_orders` テーブルもサブスクライブ（App Aでステータス更新 → カレンダーバッジ自動更新）
- 楽観的更新と組み合わせ：自分の操作は即時反映、他端末の操作はRealtimeで受信

### 6.3 データフェッチ戦略

| データ | 戦略 | キャッシュ期間 |
|--------|------|------------|
| 当日の予約一覧 | 初回ロードでフェッチ → Realtimeで差分更新 | セッション中 |
| 週間の予約一覧 | 日付変更時にフェッチ → Realtimeで差分更新 | 5分 |
| 患者マスタ | 検索時にフェッチ（デバウンス300ms） | 1分 |
| 技工物情報 | 予約詳細表示時にフェッチ | 5分 |
| スタッフ一覧 | 初回ロードでフェッチ | セッション中 |
| 設定情報 | 初回ロードでフェッチ | セッション中 |

### 6.4 バンドル最適化

| 対策 | 詳細 |
|------|------|
| FullCalendar動的インポート | `next/dynamic` でカレンダーページのみロード |
| コード分割 | ページ単位の自動分割（App Router標準） |
| Prefetch | ナビゲーション先のページをプリフェッチ |

### 6.5 レンダリング戦略

| ページ | 方式 | 理由 |
|--------|------|------|
| カレンダー | CSR | Realtimeサブスクリプション必須、インタラクション多 |
| ダッシュボード | CSR | Realtimeデータ、動的アラート |
| 患者一覧 | CSR | 検索インタラクション |
| 設定 | SSR + CSR | 初期値はSSR、変更はCSR |

-----

## 7. 画面構成とUI/UX

### 7.1 画面遷移図

```
[マスターパスワード入力]
        │
        ▼
[スタッフ選択 + PIN入力]
        │
        ▼
[ダッシュボード] ←── ヘッダー: 医院名 / ユーザー名 / ログアウト / 在庫アプリへ
   │         │         │         │
   ▼         ▼         ▼         ▼
 カレンダー   患者管理    設定     在庫アプリ
 (メイン)                         (外部リンク)
```

### 7.2 ナビゲーション

| 位置 | タブ | アイコン |
|------|------|---------|
| 1 | ダッシュボード | 🏠 |
| 2 | カレンダー | 📅 |
| 3 | 患者管理 | 👤 |
| 4 | 設定 | ⚙️ |

※ 在庫アプリへのリンクはヘッダーまたは設定画面に配置（タブには入れない）

### 7.3 各画面の詳細

#### A. マスターパスワード入力画面

- 既存アプリと同じ仕組み（共有 `clinic_settings` テーブルから検証）
- PWAアイコンは既存アプリと区別できるデザイン（カレンダーモチーフ）
- staff専用。外部ポータル認証（vendor/lab振り分け）は実装しない

#### B. スタッフ選択 + PIN入力画面

- 既存アプリと同じ仕組み（共有 `users` テーブルから検証）
- POSレジ風UI

#### C. ダッシュボード

**上部: 本日サマリー**
- 本日の総予約数 / 来院済み / 未来院 / キャンセル
- 現在空いているユニット数

**中部: 技工物アラート（最重要）**
- 本日セット予定の技工物 × 納品状況（✅ / 🚚 / ⚠️ / ❌）
- 明日セット予定（件数）
- 納品遅延（`due_date` 超過、status IN ('製作中', '出荷済み')）

**下部: 在庫アラート（簡易）**
- 発注が必要なアイテム数（タップで `app.oralcare-kanazawa.clinic` に遷移）

#### D. 予約カレンダー画面

- FullCalendar Resource Timeline View
- 上部: 日付ナビゲーション + 日/週切り替え + ユニットフィルタ
- メイン: ユニット別横並びのタイムライン
- 予約ブロック: 患者名 / 種別 / 担当スタッフ色 / 技工物バッジ / ステータス色

#### E. 予約作成・編集モーダル

| 入力項目 | 仕様 |
|----------|------|
| 患者 | インクリメンタル検索（カルテNo / 氏名 / フリガナ） |
| ユニット | プルダウン（空きスロットからの作成時は自動入力） |
| 担当スタッフ | プルダウン |
| 日時 | 日付ピッカー + 時刻ピッカー（5分刻み） |
| 所要時間 | プルダウン（10/15/20/30/45/60/90/120分） |
| 予約種別 | プルダウン（治療/衛生士/初診/急患 等） |
| 技工物セット | トグル → ON時に患者の未セット技工物一覧を表示して選択 |
| 備考 | テキストエリア |

#### F. 患者管理画面

- 上部: 検索バー（カルテNo / 氏名 / フリガナ）
- 一覧: カード形式（カルテNo、氏名、電話番号、最終来院日）
- 詳細: 基本情報、リマインド設定、予約履歴、技工物履歴

#### G. 設定画面

- ユニット数 / 診療時間 / 昼休み設定
- リマインド通知（テンプレート、送信時刻）
- スタッフ色設定
- 予約種別管理
- 休診日設定
- マスターパスワード変更
- スタッフ管理（追加・編集・無効化）

### 7.4 レスポンシブ対応

| デバイス | 画面幅 | カレンダー表示 |
|----------|--------|------------|
| モバイル | 〜640px | 1ユニットずつ表示、スワイプ切り替え |
| タブレット | 641px〜1024px | 3〜4ユニット表示（主要利用端末） |
| デスクトップ | 1025px〜 | 全ユニット表示 |

-----

## 8. セキュリティ

### 8.1 二段階認証

| 認証レイヤー | 方式 | 保持期間 |
|------------|------|---------|
| 第一の壁 | 医院共通マスターパスワード（bcryptハッシュ） | Cookie 30日間保持 |
| 第二の壁 | スタッフ別4桁PINコード（bcryptハッシュ） | 30分無操作でタイムアウト |

- staff専用。App Aの外部ポータル認証（vendor/lab）は実装しない
- 認証コードはApp Aからコピーして独立管理（共通ライブラリ化はしない）

### 8.2 API Routes

- 全DB操作はAPI Routes経由（`service_role_key` 使用）
- クライアントから直接DBへの無制限アクセスは禁止
- Supabase Realtimeのサブスクリプションは `anon_key` + RLSポリシーで制御

### 8.3 患者情報の取り扱い

- 患者情報（カルテNo、氏名、電話番号、メールアドレス）を扱う
- 現時点ではHIPAAレベルのセキュリティ要件は考慮しない
- 将来的にセキュリティ要件が厳格化した場合はAES暗号化等を検討

-----

## 9. フォルダ構成

```
/
├── app/
│   ├── layout.tsx                     # ルートレイアウト
│   ├── page.tsx                       # マスターパスワード入力画面
│   ├── pin/
│   │   └── page.tsx                   # スタッフ選択 + PIN入力画面
│   ├── dashboard/
│   │   └── page.tsx                   # ダッシュボード
│   ├── calendar/
│   │   └── page.tsx                   # 予約カレンダー（メイン画面）
│   ├── patients/
│   │   ├── page.tsx                   # 患者一覧
│   │   └── [id]/
│   │       └── page.tsx               # 患者詳細
│   ├── settings/
│   │   ├── page.tsx                   # 設定トップ
│   │   ├── staff/
│   │   │   └── page.tsx               # スタッフ管理
│   │   ├── units/
│   │   │   └── page.tsx               # ユニット・診療時間設定
│   │   ├── reminders/
│   │   │   └── page.tsx               # リマインド設定
│   │   ├── appointment-types/
│   │   │   └── page.tsx               # 予約種別管理
│   │   └── import/
│   │       └── page.tsx               # 患者CSVインポート
│   └── api/
│       ├── auth/
│       │   ├── master-password/
│       │   │   └── route.ts           # マスターパスワード検証
│       │   └── pin/
│       │       └── route.ts           # PIN検証
│       ├── appointments/
│       │   └── route.ts               # 予約CRUD
│       ├── patients/
│       │   └── route.ts               # 患者CRUD
│       ├── settings/
│       │   └── route.ts               # 設定CRUD
│       └── notifications/
│           └── route.ts               # リマインド通知（テスト送信用）
├── components/
│   ├── ui/                            # 汎用UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── SearchInput.tsx
│   │   └── Skeleton.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   └── AuthGuard.tsx
│   ├── calendar/
│   │   ├── CalendarView.tsx           # FullCalendarラッパー（dynamic import）
│   │   ├── AppointmentBlock.tsx       # 予約ブロック（カスタムイベント表示）
│   │   ├── AppointmentModal.tsx       # 予約作成・編集モーダル
│   │   ├── StatusBadge.tsx            # 来院ステータスバッジ
│   │   ├── LabOrderBadge.tsx          # 技工物納品状況バッジ
│   │   └── UnitTabs.tsx              # ユニット切り替えタブ
│   ├── patients/
│   │   ├── PatientCard.tsx
│   │   ├── PatientSearch.tsx          # インクリメンタル検索
│   │   ├── PatientForm.tsx
│   │   └── PatientHistory.tsx         # 予約・技工物履歴
│   └── dashboard/
│       ├── TodaySummary.tsx           # 本日予約サマリー
│       ├── LabOrderAlert.tsx          # 技工物セットアラート
│       └── InventoryAlert.tsx         # 在庫アラート（簡易）
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # ブラウザ用クライアント
│   │   ├── server.ts                  # サーバー用クライアント（service_role_key）
│   │   ├── realtime.ts                # Realtimeサブスクリプション管理
│   │   └── types.ts                   # DB型定義
│   ├── auth/
│   │   ├── session.ts
│   │   └── device.ts
│   └── utils/
│       ├── csv.ts                     # 患者CSVインポート処理
│       ├── format.ts
│       └── date.ts                    # 日付ユーティリティ（時間枠計算等）
├── hooks/
│   ├── useAuth.ts
│   ├── useInactivityTimer.ts
│   ├── useAppointments.ts             # 予約データ + Realtimeサブスクリプション
│   ├── usePatients.ts
│   ├── useOptimisticUpdate.ts         # 楽観的更新ヘルパー
│   └── useSettings.ts
├── public/
│   ├── icons/                         # PWAアイコン（カレンダーモチーフ）
│   └── manifest.json
├── supabase/
│   └── functions/
│       └── send-reminders/
│           └── index.ts               # リマインド通知Edge Function
├── middleware.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

-----

## 10. 開発ロードマップ

共有DB開発に適した形にPhaseを構成。各Phase完了時にApp Aの動作確認を必ず行う。

### Phase 0: プロジェクト初期化 + 認証

| Step | 内容 | 主な実装 |
|------|------|----------|
| 0-1 | プロジェクト作成 + Supabase接続 | Next.js初期化、フォルダ構成、環境変数 |
| 0-2 | 認証の移植 | マスターPW + PIN（staff専用）、AuthGuard、middleware |

→ デプロイ → App A が壊れていないことを確認

### Phase 1: 患者 + 予約の基本機能

| Step | 内容 | 主な実装 |
|------|------|----------|
| 1-1 | 患者マスタ | patients テーブル + CRUD + 画面 + CSVインポート |
| 1-2 | 予約CRUD | appointments テーブル + CRUD + 予約モーダル |
| 1-3 | カレンダー表示 | FullCalendar Resource Timeline、日/週切り替え、D&D |

→ デプロイ → カレンダー上で予約の作成・表示ができることを確認

### Phase 2: リアルタイム + ステータス + 技工物連動

| Step | 内容 | 主な実装 |
|------|------|----------|
| 2-1 | ステータス + Realtime | 来院ステータス管理、Supabase Realtime、楽観的UI更新 |
| 2-2 | 技工物連動 + ダッシュボード | 技工物紐付け、カレンダーバッジ、ダッシュボード統合アラート |

→ デプロイ → 複数端末同期テスト + App A への影響確認

### Phase 3: 仕上げ

| Step | 内容 | 主な実装 |
|------|------|----------|
| 3-1 | リマインド通知 | Twilio SMS + Resend メール + Edge Function |
| 3-2 | パフォーマンス最適化 | バンドル最適化、iPad最適化、PWA、休診日対応 |
| 3-3 | 相互リンク + ドキュメント | App A ↔ App B リンク設置、CLAUDE.md更新 |

→ 本番運用開始

-----

## 11. CLAUDE.md 用サマリー

```markdown
# 歯科医院 予約・来院管理アプリ（App B）

## 技術スタック
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- Supabase Pro（既存の在庫・技工物管理アプリ App A とDB共有）
- Supabase Realtime（予約ステータス + 技工物ステータスの全端末同期）
- FullCalendar（Resource Timeline View）
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
```

-----

## 12. 変更履歴

| バージョン | 日付 | 主な変更点 |
|-----------|------|----------|
| v1.0 | 2026-02 | 初版。予約・来院管理アプリとして設計 |
| v1.1 | 2026-02 | App A v4.0との差分を反映（出荷済みステータス、memo追記方式、suppliersテーブル、外部ポータル、メンテナンステーブル）。ドメイン確定（`appo.oralcare-kanazawa.clinic`）。開発ロードマップをPhase 0〜3に再構成（認証の独立確認を先行）。共有DB開発の鉄則を追加。lab_orders.patient_idとpatients.chart_numberの照合方法を明記 |

-----

*予約・来院管理アプリ マスタープラン v1.1 — 最終更新: 2026年2月*
