import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// POST: 定休曜日を一括更新
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { days } = body as { days: number[] }

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: 'days は配列で指定してください' }, { status: 400 })
    }

    // 既存の weekly を全削除
    const { error: deleteError } = await supabase
      .from('clinic_holidays')
      .delete()
      .eq('holiday_type', 'weekly')

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // 新しい定休曜日を一括挿入
    if (days.length > 0) {
      const rows = days
        .filter((d) => d >= 0 && d <= 6)
        .map((day_of_week) => ({
          holiday_type: 'weekly',
          day_of_week,
          is_active: true,
        }))

      const { error: insertError } = await supabase
        .from('clinic_holidays')
        .insert(rows)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
