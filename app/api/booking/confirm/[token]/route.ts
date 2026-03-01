import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { toPatientDisplayName } from '@/lib/utils/patient-display'
import { formatPatientName } from '@/lib/utils/patient-name'

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
        id, start_time, duration_minutes, status, booking_source, booking_type_id,
        patient:patients!patient_id(last_name, first_name),
        booking_type:booking_types!left(display_name, duration_minutes, category, is_web_bookable)
      `)
      .eq('booking_token', token)
      .eq('is_deleted', false)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    // 患者名
    const patient = data.patient && !Array.isArray(data.patient)
      ? (data.patient as { last_name: string; first_name: string })
      : null
    // 予約種別
    const bookingType = data.booking_type && !Array.isArray(data.booking_type)
      ? (data.booking_type as { display_name: string; duration_minutes: number; category: string | null; is_web_bookable: boolean })
      : null

    // 患者向け表示名に変換
    const patientDisplayName = bookingType
      ? toPatientDisplayName(bookingType.display_name, bookingType.category, bookingType.is_web_bookable)
      : ''

    return NextResponse.json({
      appointment: {
        start_time: data.start_time,
        duration_minutes: data.duration_minutes,
        status: data.status,
        patient_name: patient ? formatPatientName(patient.last_name, patient.first_name) : '',
        booking_type_name: patientDisplayName,
        booking_type_id: data.booking_type_id || '',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
