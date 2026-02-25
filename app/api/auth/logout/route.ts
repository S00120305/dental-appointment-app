import { NextResponse } from 'next/server'
import { PIN_SESSION_COOKIE } from '@/lib/auth/session-token'
import { DEVICE_AUTH_COOKIE } from '@/lib/auth/device'
import { appendLegacyCookieDelete } from '@/lib/auth/cookie-utils'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    // domain付きCookieを削除（cookies.set()で内部Map経由）
    response.cookies.set(PIN_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    response.cookies.set(DEVICE_AUTH_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    // 古いCookie（domainなし）を削除（cookies.set()の後に呼ぶこと）
    appendLegacyCookieDelete(response, PIN_SESSION_COOKIE)
    appendLegacyCookieDelete(response, DEVICE_AUTH_COOKIE)
    return response
  } catch {
    return NextResponse.json(
      { error: 'ログアウト処理に失敗しました' },
      { status: 500 }
    )
  }
}
