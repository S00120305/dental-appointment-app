import { cookies } from 'next/headers'
import { PIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session-token'

/**
 * API Route内でCookieからセッションユーザーを取得
 * 取得できない場合は null を返す（ログ記録失敗でAPI自体は止めない）
 */
export async function getSessionUser(): Promise<{ userId: string; userName: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PIN_SESSION_COOKIE)?.value
    if (!token) return null

    const session = verifySessionToken(token)
    if (!session) return null

    return { userId: session.userId, userName: session.userName }
  } catch {
    return null
  }
}
