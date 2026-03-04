# セキュリティ強化ガイド（App A 向け指示書）

App B（予約・来院管理）で実施したセキュリティ強化の内容をまとめたものです。
App A（在庫・技工物管理）でも同様の対策を実施してください。

---

## 1. API Route 認証ガード

### 概要
全ての変更系（POST/PUT/PATCH/DELETE）API Route の先頭で認証チェックを行う。
認証なしで DB を操作できる状態を防ぐ。

### 実装方法

#### 1-1. `lib/auth/require-auth.ts` を作成

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { PIN_SESSION_COOKIE, verifySessionToken } from './session-token'

export type AuthSession = {
  userId: string
  userName: string
  isAdmin: boolean
}

/**
 * API Route で認証を必須にするヘルパー。
 * セッションが有効ならユーザー情報を返す。
 * 無効なら 401 NextResponse を返す。
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PIN_SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const session = verifySessionToken(token)
    if (!session) {
      return NextResponse.json({ error: 'セッションが無効または期限切れです' }, { status: 401 })
    }

    return { userId: session.userId, userName: session.userName, isAdmin: session.isAdmin }
  } catch {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }
}

/**
 * cron エンドポイント用の認証ヘルパー。
 * CRON_SECRET が未設定の場合は拒否する（安全側に倒す）。
 */
export function requireCronAuth(authHeader: string | null): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null // 認証成功
}
```

#### 1-2. 各 API Route に適用

**変更系ハンドラ（POST/PUT/PATCH/DELETE）の先頭に追加：**

```typescript
import { requireAuth } from '@/lib/auth/require-auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  // auth.userId, auth.userName, auth.isAdmin が使える

  // ... 既存の処理
}
```

**GET（読み取り）ルートは任意**だが、機密データを返すルートには付けることを推奨。

#### 1-3. cron エンドポイントの場合

```typescript
import { requireCronAuth } from '@/lib/auth/require-auth'

export async function POST(request: Request) {
  const cronError = requireCronAuth(request.headers.get('authorization'))
  if (cronError) return cronError

  // ... cron 処理
}
```

#### 1-4. 適用対象の判断基準

| ルート種別 | requireAuth | 備考 |
|---|---|---|
| 変更系 (POST/PUT/PATCH/DELETE) | **必須** | 全 mutation ルートに適用 |
| GET（スタッフ向けデータ） | 推奨 | 患者情報、設定情報など |
| GET（公開データ） | 不要 | 公開 Web ページ用 |
| 認証ルート (/api/auth/*) | 不要 | ログイン処理自体 |
| cron ルート | requireCronAuth | CRON_SECRET で認証 |

---

## 2. セッショントークンの署名キー分離

### 概要
セッショントークンの HMAC 署名に専用の `SESSION_SECRET` 環境変数を使う。
`SUPABASE_SERVICE_ROLE_KEY` のみに依存しない。

### 対応

1. `.env.local` に追加：
   ```
   SESSION_SECRET=（64文字以上のランダム文字列）
   ```

2. Vercel の環境変数にも同じ値を設定

3. `session-token.ts` の `getSecret()` を以下に変更：
   ```typescript
   function getSecret(): string {
     const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
     if (!secret) throw new Error('SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is not set')
     return secret
   }
   ```

---

## 3. DB マイグレーション（共有 DB 対応）

以下は App B 側で既に適用済みです。
App A 側ではローカルのマイグレーションファイルとして記録してください。

### 3-1. RLS 有効化（017）- 適用済み

App B テーブルの RLS を有効化しました。
**App A 側で必要な対応：** App A 専用テーブルで RLS が無効なものがあれば有効化。

```sql
-- 例: App A 専用テーブルに対して
ALTER TABLE IF EXISTS <テーブル名> ENABLE ROW LEVEL SECURITY;
```

**確認方法：**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

`rowsecurity = false` のテーブルが対象です。

### 3-2. FK インデックス（016, 019）- 適用済み

以下のインデックスを追加済み：

```
idx_appointments_staff_id
idx_appointments_booking_type_id (partial)
idx_appointments_booking_source (partial)
idx_appointments_lab_order_id (partial)
idx_notification_logs_appointment_id
idx_booking_tokens_patient_id (partial)
idx_booking_tokens_appointment_id (partial)
idx_booking_tokens_booking_type_id
idx_booking_tokens_staff_id (partial)
idx_booking_tokens_created_by
idx_appointment_tag_links_appointment_id
idx_appointment_tag_links_tag_id
idx_staff_holidays_user_date (partial)
idx_blocked_slots_created_by
idx_appointment_settings_updated_by (partial)
```

**App A 側で必要な対応：**
Supabase Dashboard → Database Linter で「Unindexed foreign keys」を確認し、
App A のテーブル（orders, items, lab_orders, maintenance_items, maintenance_logs 等）の
未インデックス FK にインデックスを追加してください。

```sql
-- 例: Advisor で指摘された FK
CREATE INDEX IF NOT EXISTS idx_lab_orders_created_by
  ON lab_orders (created_by);

CREATE INDEX IF NOT EXISTS idx_orders_received_by
  ON orders (received_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_done_by
  ON maintenance_items (done_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_done_by
  ON maintenance_logs (done_by);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id
  ON transactions (order_id);

CREATE INDEX IF NOT EXISTS idx_clinic_settings_updated_by
  ON clinic_settings (updated_by);
```

### 3-3. 過剰 RLS ポリシー削除（018）- 適用済み

`USING(true)` の全権限ポリシーを削除しました。
service_role_key は RLS をバイパスするためポリシー不要です。

**App A 側で必要な対応：**
```sql
-- 自分のテーブルに USING(true) ポリシーがないか確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

`qual = 'true'` かつ `cmd = 'ALL'` のポリシーがあれば削除対象です。

### 3-4. 関数 search_path 修正（020）- 適用済み

`update_updated_at` 関数の search_path を固定しました。

**App A 側で必要な対応：** `adjust_stock` 関数も同様に修正してください。

```sql
-- adjust_stock の現在の定義を確認
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'adjust_stock' AND pronamespace = 'public'::regnamespace;

-- 既存の定義に SET search_path = public を追加して CREATE OR REPLACE
-- （上のクエリで得た定義をコピーし、AS $function$ の前に追加）
```

---

## 4. Middleware の整理

### 概要
Next.js middleware でデバイス認証 Cookie の存在チェックのみ行う。
API Route の認証は middleware ではなく `requireAuth()` で行う。

### App B の middleware 構成（参考）

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API は middleware では何もしない（requireAuth で個別チェック）
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 公開ページはスキップ
  if (pathname.startsWith('/booking')) {
    return NextResponse.next()
  }

  // デバイス認証 Cookie の存在確認のみ
  const deviceAuth = request.cookies.get('device_auth')
  if (!deviceAuth) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}
```

**ポイント：**
- `/api/` ルートは middleware でブロックしない（Edge Runtime の制約回避）
- 認証は各 API Route 内で `requireAuth()` により Node.js ランタイムで実行
- middleware はページアクセスのリダイレクト制御のみ担当

---

## 5. 環境変数チェックリスト

App A の `.env.local` と Vercel 環境変数に以下が設定されていることを確認：

| 変数名 | 用途 | 必須 |
|---|---|---|
| `SESSION_SECRET` | セッショントークン署名キー | 推奨（未設定時は SERVICE_ROLE_KEY fallback） |
| `CRON_SECRET` | cron エンドポイント認証 | cron がある場合は必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB アクセス | 必須 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 必須 |

---

## 6. 確認手順（チェックリスト）

- [ ] `lib/auth/require-auth.ts` を作成した
- [ ] 全変更系 API Route に `requireAuth()` を追加した
- [ ] cron エンドポイントに `requireCronAuth()` を追加した
- [ ] `SESSION_SECRET` 環境変数を設定した
- [ ] App A テーブルの RLS が全て有効か確認した
- [ ] App A テーブルの未インデックス FK にインデックスを追加した
- [ ] `USING(true)` の過剰ポリシーを削除した
- [ ] `adjust_stock` 関数の search_path を修正した
- [ ] middleware が `/api/` をスキップしていることを確認した
- [ ] ビルドが通ることを確認した

---

## 7. Supabase Advisor での継続確認

定期的に以下で確認してください：

- **Security Advisor**: Dashboard → Database → Linter → Security
- **Performance Advisor**: Dashboard → Database → Linter → Performance

主な確認ポイント：
- `rls_policy_always_true` (WARN) → USING(true) ポリシーの削除漏れ
- `function_search_path_mutable` (WARN) → 関数の search_path 未設定
- `unindexed_foreign_keys` (INFO) → FK のインデックス追加
