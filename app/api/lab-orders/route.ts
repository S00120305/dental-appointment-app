import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 技工物一覧取得（読み取りのみ — App A 管理テーブル）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const patientChartNumber = searchParams.get('patient_id') // カルテNo（テキスト型）
    const forAppointment = searchParams.get('for_appointment') // 予約紐付け用フィルター

    let query = supabase
      .from('lab_orders')
      .select(`
        id, patient_id, lab_id, item_type, tooth_info, status,
        due_date, set_date, memo, is_deleted, created_at, updated_at,
        lab:labs!left(id, name)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    // 患者フィルター（lab_orders.patient_id はカルテNo テキスト型）
    if (patientChartNumber) {
      query = query.eq('patient_id', patientChartNumber)
    }

    // 予約紐付け用: セット完了・キャンセル以外の技工物
    if (forAppointment === 'true') {
      query = query.in('status', ['未発注', '製作中', '納品済み'])
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lab_orders: data || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
