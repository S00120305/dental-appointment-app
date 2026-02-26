import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// PATCH: 予約種別の並び順を一括更新
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const items: { id: string; sort_order: number }[] = body.items

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items は必須です' }, { status: 400 })
    }

    // 個別にアップデート（Supabaseには一括update-by-id がないため）
    const errors: string[] = []
    for (const item of items) {
      const { error } = await supabase
        .from('booking_types')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)

      if (error) errors.push(error.message)
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
