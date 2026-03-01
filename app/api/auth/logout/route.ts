import { NextResponse } from 'next/server'
import { PIN_SESSION_COOKIE } from '@/lib/auth/session-token'
import { appendLegacyCookieDelete } from '@/lib/auth/cookie-utils'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    // PINセッションCookieのみ削除（デバイス認証は維持）
    response.cookies.set(PIN_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    // 古いCookie（domainなし）を削除
    appendLegacyCookieDelete(response, PIN_SESSION_COOKIE)
    return response
  } catch {
    return NextResponse.json(
      { error: 'ログアウト処理に失敗しました' },
      { status: 500 }
    )
  }
}
