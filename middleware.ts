import { NextRequest, NextResponse } from 'next/server'

const DEVICE_AUTH_COOKIE = 'device_auth'
const PIN_SESSION_COOKIE = 'pin_session'

// 認証不要のパス
const PUBLIC_PATHS = ['/', '/api/auth/master-password']

// デバイス認証のみ必要（PIN不要）なパス
const DEVICE_AUTH_ONLY_PATHS = ['/api/auth/pin', '/api/auth/logout']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パス — 認証不要
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // デバイス認証チェック（全保護ルート共通）
  const deviceAuth = request.cookies.get(DEVICE_AUTH_COOKIE)
  if (!deviceAuth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Device authentication required' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // APIルートの追加チェック
  if (pathname.startsWith('/api/')) {
    // デバイス認証のみで許可するAPI
    if (DEVICE_AUTH_ONLY_PATHS.includes(pathname)) {
      return NextResponse.next()
    }

    // /api/users GET はPIN画面のスタッフ一覧取得に必要（デバイス認証のみ）
    if (pathname === '/api/users' && request.method === 'GET') {
      return NextResponse.next()
    }

    // その他の全APIルート — PINセッションCookie必須
    const pinSession = request.cookies.get(PIN_SESSION_COOKIE)
    if (!pinSession?.value) {
      return NextResponse.json(
        { error: 'PIN session required' },
        { status: 401 }
      )
    }

    // トークンの形式チェック（payload.signature）
    if (!pinSession.value.includes('.')) {
      return NextResponse.json(
        { error: 'Invalid session token' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  // ページルート — デバイス認証のみ（PIN認証はクライアントのAuthGuardで処理）
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
}
