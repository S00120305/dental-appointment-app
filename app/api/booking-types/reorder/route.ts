import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// PATCH: 予約種別の並び順を一括更新
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const items: { id: string; sort_order: number }[] = body.items

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items は必須です' }, { status: 400 })
    }

    // 個別にアップデート（Supabaseには一括update-by-id がないため）
    let failCount = 0
    for (const item of items) {
      const { error } = await supabase
        .from('booking_types')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)

      if (error) {
        console.error('Reorder update failed:', error.message)
        failCount++
      }
    }

    if (failCount > 0) {
      return NextResponse.json({ error: `並び順の更新中に${failCount}件のエラーが発生しました` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
