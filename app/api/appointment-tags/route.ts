import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { requireAuth } from '@/lib/auth/require-auth'

// GET: 注意事項タグ一覧
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = supabase
      .from('appointment_tags')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ appointment_tags: data })
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

    const { name, icon, color, sort_order } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'タグ名は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointment_tags')
      .insert({
        name: name.trim(),
        icon: icon?.trim() || null,
        color: color?.trim() || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'create',
      targetType: 'appointment_tag',
      targetId: data?.id,
      summary: `${user?.userName || '不明'}が 注意事項タグ「${name.trim()}」を作成`,
      details: { name, icon, color },
    })

    return NextResponse.json({ appointment_tag: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
