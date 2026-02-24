import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// GET: 予約確認情報取得（公開API）
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 60, windowMs: 60_000, name: 'booking-read' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'トークンは必須です' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, start_time, duration_minutes, status, booking_source,
        patient:patients!patient_id(name),
        booking_type:booking_types!left(display_name, duration_minutes)
      `)
      .eq('booking_token', token)
      .eq('is_deleted', false)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    // 患者名
    const patient = data.patient && !Array.isArray(data.patient)
      ? (data.patient as { name: string })
      : null
    // 予約種別
    const bookingType = data.booking_type && !Array.isArray(data.booking_type)
      ? (data.booking_type as { display_name: string; duration_minutes: number })
      : null

    return NextResponse.json({
      appointment: {
        start_time: data.start_time,
        duration_minutes: data.duration_minutes,
        status: data.status,
        patient_name: patient?.name || '',
        booking_type_name: bookingType?.display_name || '',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
