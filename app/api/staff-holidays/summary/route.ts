import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json({ error: 'year と month は必須です' }, { status: 400 })
    }

    const m = String(month).padStart(2, '0')
    const lastDay = new Date(Number(year), Number(month), 0).getDate()

    const { data, error } = await supabase
      .from('staff_holidays')
      .select('user_id, holiday_type')
      .eq('is_deleted', false)
      .gte('holiday_date', `${year}-${m}-01`)
      .lte('holiday_date', `${year}-${m}-${String(lastDay).padStart(2, '0')}`)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // スタッフ別集計
    const summary: Record<string, Record<string, number>> = {}
    for (const h of data || []) {
      if (!summary[h.user_id]) {
        summary[h.user_id] = { paid_leave: 0, day_off: 0, half_day_am: 0, half_day_pm: 0, other: 0, total: 0 }
      }
      summary[h.user_id][h.holiday_type] = (summary[h.user_id][h.holiday_type] || 0) + 1
      summary[h.user_id].total++
    }

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
