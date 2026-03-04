import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { requireAuth } from '@/lib/auth/require-auth'

// PUT: 予約種別の更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const supabase = createServerClient()
    const body = await request.json()

    const {
      display_name, internal_name, duration_minutes,
      confirmation_mode, is_web_bookable, is_token_only,
      description, notes, color, category, unit_type, sort_order,
    } = body

    if (!display_name?.trim()) {
      return NextResponse.json({ error: '患者向け名称は必須です' }, { status: 400 })
    }
    if (!internal_name?.trim()) {
      return NextResponse.json({ error: '院内種別名は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('booking_types')
      .update({
        display_name: display_name.trim(),
        internal_name: internal_name.trim(),
        duration_minutes,
        confirmation_mode: confirmation_mode || 'approval',
        is_web_bookable: is_web_bookable ?? true,
        is_token_only: is_token_only ?? false,
        description: description ?? '',
        notes: notes ?? '',
        color: color || '#3B82F6',
        category: category?.trim() || null,
        unit_type: unit_type || 'any',
        sort_order: sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'booking_type',
      targetId: id,
      summary: `${user?.userName || '不明'}が 予約種別「${display_name.trim()}」を更新`,
      details: { display_name, internal_name, duration_minutes, confirmation_mode },
    })

    return NextResponse.json({ booking_type: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 無効化（is_active = false）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const supabase = createServerClient()

    // 削除前に情報取得
    const { data: target } = await supabase
      .from('booking_types')
      .select('display_name, internal_name')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('booking_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'delete',
      targetType: 'booking_type',
      targetId: id,
      summary: `${user?.userName || '不明'}が 予約種別「${target?.display_name || '不明'}」を無効化`,
      details: { display_name: target?.display_name, internal_name: target?.internal_name },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
