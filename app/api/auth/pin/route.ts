import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { createServerClient } from '@/lib/supabase/server'
import {
  generateSessionToken,
  PIN_SESSION_COOKIE,
  PIN_SESSION_MAX_AGE,
} from '@/lib/auth/session-token'

export async function POST(request: NextRequest) {
  try {
    const { userId, pin } = await request.json()

    if (!userId || !pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'ユーザーIDとPINを入力してください' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PINは4桁の数字で入力してください' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, pin_hash, is_active, is_admin, failed_pin_attempts, locked_until')
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      )
    }

    // ロック中かチェック
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until)
      const now = new Date()

      if (now < lockedUntil) {
        const remainingSeconds = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 1000
        )
        return NextResponse.json(
          {
            error: `アカウントがロックされています。${Math.ceil(remainingSeconds / 60)}分後に再試行してください`,
            locked: true,
            remainingSeconds,
          },
          { status: 423 }
        )
      }

      await supabase
        .from('users')
        .update({ failed_pin_attempts: 0, locked_until: null })
        .eq('id', userId)
    }

    const isValid = await bcrypt.compare(pin, user.pin_hash)

    if (!isValid) {
      const newAttempts = (user.failed_pin_attempts || 0) + 1

      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        await supabase
          .from('users')
          .update({
            failed_pin_attempts: newAttempts,
            locked_until: lockUntil,
          })
          .eq('id', userId)

        return NextResponse.json(
          {
            error: '5回連続で失敗しました。5分間ロックされます',
            locked: true,
            remainingSeconds: 300,
          },
          { status: 423 }
        )
      }

      await supabase
        .from('users')
        .update({ failed_pin_attempts: newAttempts })
        .eq('id', userId)

      return NextResponse.json(
        {
          error: '認証に失敗しました',
          remainingAttempts: 5 - newAttempts,
        },
        { status: 401 }
      )
    }

    // 認証成功
    await supabase
      .from('users')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('id', userId)

    const isAdmin = !!user.is_admin
    const sessionToken = generateSessionToken(user.id, user.name, isAdmin)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        isAdmin,
      },
    })

    response.cookies.set(PIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: PIN_SESSION_MAX_AGE,
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
