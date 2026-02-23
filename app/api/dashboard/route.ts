import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: ダッシュボード用データ一括取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD（JST）

    if (!dateStr) {
      return NextResponse.json({ error: 'date パラメータは必須です' }, { status: 400 })
    }

    const dayStart = `${dateStr}T00:00:00+09:00`
    const dayEnd = `${dateStr}T23:59:59+09:00`

    // 翌日
    const nextDate = new Date(dateStr + 'T00:00:00+09:00')
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]
    const nextDayStart = `${nextDateStr}T00:00:00+09:00`
    const nextDayEnd = `${nextDateStr}T23:59:59+09:00`

    // 1. 本日の予約一覧（ステータス集計 + 技工物JOIN用）
    const { data: todayAppointments } = await supabase
      .from('appointments')
      .select(`
        id, start_time, unit_number, status, lab_order_id, duration_minutes,
        patient:patients!patient_id(id, chart_number, name),
        staff:users!staff_id(id, name)
      `)
      .eq('is_deleted', false)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time', { ascending: true })

    // 2. 本日のセット予定（lab_order_id が設定されている予約）
    const labOrderIds = (todayAppointments || [])
      .filter(a => a.lab_order_id)
      .map(a => a.lab_order_id as string)

    let todayLabOrders: Record<string, unknown>[] = []
    if (labOrderIds.length > 0) {
      const { data } = await supabase
        .from('lab_orders')
        .select(`
          id, status, item_type, tooth_info, due_date, set_date,
          lab:labs!left(id, name)
        `)
        .in('id', labOrderIds)
        .eq('is_deleted', false)

      todayLabOrders = data || []
    }

    // 3. 明日のセット予定数
    const { data: tomorrowAppointments } = await supabase
      .from('appointments')
      .select('id, lab_order_id')
      .eq('is_deleted', false)
      .gte('start_time', nextDayStart)
      .lte('start_time', nextDayEnd)
      .not('lab_order_id', 'is', null)

    // 4. 納品遅延の技工物（due_date < 今日 & まだ製作中）
    const { data: overdueLabOrders } = await supabase
      .from('lab_orders')
      .select(`
        id, patient_id, status, item_type, tooth_info, due_date,
        lab:labs!left(id, name)
      `)
      .eq('is_deleted', false)
      .lt('due_date', dateStr)
      .in('status', ['製作中'])

    // 5. 在庫アラート数（発注点以下のアイテム）
    const { count: inventoryAlertCount } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .filter('current_stock', 'lte', 'reorder_point' as unknown as string)

    // RPC or raw filter for current_stock <= reorder_point
    // Supabase doesn't support column-to-column comparison in .filter, so use RPC or fetch all
    const { data: inventoryItems } = await supabase
      .from('items')
      .select('id, current_stock, reorder_point')
      .eq('is_deleted', false)

    const actualAlertCount = (inventoryItems || []).filter(
      item => item.current_stock != null && item.reorder_point != null && item.current_stock <= item.reorder_point
    ).length

    return NextResponse.json({
      todayAppointments: todayAppointments || [],
      todayLabOrders,
      tomorrowLabOrderCount: (tomorrowAppointments || []).length,
      overdueLabOrders: overdueLabOrders || [],
      inventoryAlertCount: actualAlertCount,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
