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
 *
 * 使い方:
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth
 *   // auth: AuthSession
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
 * CRON_SECRET が設定されている場合は Bearer トークンで認証する。
 * 未設定の場合も拒否する（安全側に倒す）。
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
