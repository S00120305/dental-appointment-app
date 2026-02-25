import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /api/ は middleware では何もしない
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // / (マスターPW画面): device_auth があれば /pin へスキップ
  if (pathname === '/') {
    const deviceAuth = request.cookies.get('device_auth')
    if (deviceAuth) {
      return NextResponse.redirect(new URL('/pin', request.url))
    }
    return NextResponse.next()
  }

  // /booking 以下は患者向け公開ページ（認証不要）
  if (pathname.startsWith('/booking')) {
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
