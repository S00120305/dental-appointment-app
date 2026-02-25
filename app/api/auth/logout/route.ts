import { NextResponse } from 'next/server'
import { PIN_SESSION_COOKIE } from '@/lib/auth/session-token'
import { DEVICE_AUTH_COOKIE } from '@/lib/auth/device'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    // 古いCookie（domainなし）と新しいCookie（domain付き）の両方を削除
    response.cookies.set(PIN_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })
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
    })
    response.cookies.set(DEVICE_AUTH_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    return response
  } catch {
    return NextResponse.json(
      { error: 'ログアウト処理に失敗しました' },
      { status: 500 }
    )
  }
}
