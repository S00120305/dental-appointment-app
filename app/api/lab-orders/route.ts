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
        *,
        lab:labs!lab_id(id, name)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    // 患者フィルター（lab_orders.patient_id はカルテNo テキスト型）
    if (patientChartNumber) {
      query = query.eq('patient_id', patientChartNumber)
    }

    // 予約紐付け用: 未セットの技工物のみ（製作中/出荷済み/納品済み）
    if (forAppointment === 'true') {
      query = query.in('status', ['製作中', '出荷済み', '納品済み'])
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lab_orders: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
