import { NextResponse } from 'next/server'
import { PIN_SESSION_COOKIE } from '@/lib/auth/session-token'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    response.cookies.set(PIN_SESSION_COOKIE, '', {
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
