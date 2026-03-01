import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 通知ログ一覧（フィルタ対応）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '30', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('notification_logs')
      .select(
        'id, patient_id, appointment_id, channel, type, status, content, error_message, created_at, patient:patients!patient_id(last_name, first_name, chart_number)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00+09:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59+09:00`)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (type) {
      query = query.eq('type', type)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // patient JOIN の配列対応
    const logs = (data || []).map((log) => {
      const patientRaw = log.patient as unknown
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw
      return { ...log, patient }
    })

    return NextResponse.json({ logs, total: count || 0 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
