import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { requireAuth } from '@/lib/auth/require-auth'

// GET: 予約種別一覧（is_active=true のみ）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = supabase
      .from('booking_types')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ booking_types: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 新規作成
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
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
    if (!duration_minutes || duration_minutes < 5) {
      return NextResponse.json({ error: '所要時間は5分以上で指定してください' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('booking_types')
      .insert({
        display_name: display_name.trim(),
        internal_name: internal_name.trim(),
        duration_minutes,
        confirmation_mode: confirmation_mode || 'approval',
        is_web_bookable: is_web_bookable ?? true,
        is_token_only: is_token_only ?? false,
        description: description || '',
        notes: notes || '',
        color: color || '#3B82F6',
        category: category?.trim() || null,
        unit_type: unit_type || 'any',
        sort_order: sort_order ?? 0,
      })
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
      actionType: 'create',
      targetType: 'booking_type',
      targetId: data?.id,
      summary: `${user?.userName || '不明'}が 予約種別「${display_name.trim()}」を作成`,
      details: { display_name, internal_name, duration_minutes, confirmation_mode },
    })

    return NextResponse.json({ booking_type: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
