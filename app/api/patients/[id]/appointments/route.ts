import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 患者の予約一覧（今後 + 過去）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const pastLimit = parseInt(searchParams.get('past_limit') || '5')
    const pastOffset = parseInt(searchParams.get('past_offset') || '0')

    const selectQuery = `
      id, start_time, duration_minutes, appointment_type, status, memo,
      staff:users!staff_id(id, name),
      lab_order:lab_orders!left(id, status, item_type, tooth_info, due_date, set_date, lab:labs!left(id, name))
    `

    const now = new Date().toISOString()

    // 今後の予約（昇順）
    const { data: futureData } = await supabase
      .from('appointments')
      .select(selectQuery)
      .eq('patient_id', id)
      .eq('is_deleted', false)
      .gte('start_time', now)
      .not('status', 'in', '("cancelled","no_show")')
      .order('start_time', { ascending: true })

    // 過去の予約（降順、ページング）
    const { data: pastData, count: pastCount } = await supabase
      .from('appointments')
      .select(selectQuery, { count: 'exact' })
      .eq('patient_id', id)
      .eq('is_deleted', false)
      .lt('start_time', now)
      .order('start_time', { ascending: false })
      .range(pastOffset, pastOffset + pastLimit - 1)

    // キャンセル済みも過去に含める（start_time が未来でも cancelled/no_show のもの）
    const { data: cancelledFuture } = await supabase
      .from('appointments')
      .select(selectQuery)
      .eq('patient_id', id)
      .eq('is_deleted', false)
      .gte('start_time', now)
      .in('status', ['cancelled', 'no_show'])
      .order('start_time', { ascending: false })

    const past = [...(cancelledFuture || []), ...(pastData || [])]

    return NextResponse.json({
      future: futureData || [],
      past,
      hasMorePast: (pastCount || 0) > pastOffset + pastLimit,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
