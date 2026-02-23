import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // / (マスターPW画面) と /api/ は middleware では何もしない
  if (pathname === '/' || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 旧ページから /appointments へリダイレクト
  if (pathname === '/today' || pathname === '/calendar') {
    return NextResponse.redirect(new URL('/appointments', request.url))
  }

  // デバイス認証Cookie の存在確認のみ
  const deviceAuth = request.cookies.get('device_auth')
  if (!deviceAuth) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
