import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { requireAuth } from '@/lib/auth/require-auth'

// PUT: タグ更新
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

    const { name, icon, color, sort_order, is_active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'タグ名は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointment_tags')
      .update({
        name: name.trim(),
        icon: icon?.trim() || null,
        color: color?.trim() || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'appointment_tag',
      targetId: id,
      summary: `${user?.userName || '不明'}が 注意事項タグ「${name.trim()}」を更新`,
      details: { name, icon, color, is_active },
    })

    return NextResponse.json({ appointment_tag: data })
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

    const { data: target } = await supabase
      .from('appointment_tags')
      .select('name')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('appointment_tags')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'delete',
      targetType: 'appointment_tag',
      targetId: id,
      summary: `${user?.userName || '不明'}が 注意事項タグ「${target?.name || '不明'}」を無効化`,
      details: { name: target?.name },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
