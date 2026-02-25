import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { createServerClient } from '@/lib/supabase/server'
import { DEVICE_AUTH_COOKIE, DEVICE_AUTH_MAX_AGE } from '@/lib/auth/device'

// IPベースのレート制限
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCK_DURATION = 5 * 60 * 1000 // 5分

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): { blocked: boolean; remainingSeconds?: number } {
  const entry = failedAttempts.get(ip)
  if (!entry) return { blocked: false }

  if (entry.lockedUntil > Date.now()) {
    return {
      blocked: true,
      remainingSeconds: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    }
  }

  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    failedAttempts.delete(ip)
  }

  return { blocked: false }
}

function recordFailure(ip: string): void {
  const entry = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION
  }
  failedAttempts.set(ip, entry)
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip)
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    const rateLimit = checkRateLimit(ip)
    if (rateLimit.blocked) {
      return NextResponse.json(
        {
          error: `試行回数の上限に達しました。${Math.ceil((rateLimit.remainingSeconds || 0) / 60)}分後に再試行してください`,
          locked: true,
          remainingSeconds: rateLimit.remainingSeconds,
        },
        { status: 429 }
      )
    }

    const { password } = await request.json()

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'パスワードを入力してください' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'master_password_hash')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'マスターパスワードが設定されていません' },
        { status: 500 }
      )
    }

    const isValid = await bcrypt.compare(password, data.value)

    if (!isValid) {
      recordFailure(ip)
      return NextResponse.json(
        { error: 'パスワードが正しくありません' },
        { status: 401 }
      )
    }

    clearFailures(ip)

    const response = NextResponse.json({ success: true })

    response.cookies.set(DEVICE_AUTH_COOKIE, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: DEVICE_AUTH_MAX_AGE,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
