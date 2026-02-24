import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// GET: トークン情報取得（公開API）
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 60, windowMs: 60_000, name: 'booking-token-read' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。' },
        { status: 429 }
      )
    }

    const { token } = await props.params
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('booking_tokens')
      .select(`
        id, token, patient_id, booking_type_id, duration_minutes,
        staff_id, unit_number, status, expires_at, used_at, appointment_id,
        patient:patients!patient_id(id, name),
        booking_type:booking_types!booking_type_id(id, display_name, internal_name, duration_minutes, is_active),
        staff:users!staff_id(id, name)
      `)
      .eq('token', token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'このご案内番号は無効です', code: 'invalid' }, { status: 404 })
    }

    // ステータスチェック
    if (data.status === 'used') {
      // 使用済み: 紐付く予約の booking_token を返す
      let confirmToken = null
      if (data.appointment_id) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('booking_token')
          .eq('id', data.appointment_id)
          .single()
        confirmToken = appt?.booking_token
      }
      return NextResponse.json({
        error: 'このご案内は使用済みです',
        code: 'used',
        confirm_token: confirmToken,
      }, { status: 410 })
    }

    if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
      return NextResponse.json({
        error: 'このご案内の有効期限が切れています。お電話でご予約ください。',
        code: 'expired',
      }, { status: 410 })
    }

    // 患者情報
    const patient = data.patient && !Array.isArray(data.patient)
      ? (data.patient as { id: string; name: string })
      : null

    // 予約種別情報
    const bookingType = data.booking_type && !Array.isArray(data.booking_type)
      ? (data.booking_type as { id: string; display_name: string; internal_name: string; duration_minutes: number; is_active: boolean })
      : null

    // スタッフ情報
    const staff = data.staff && !Array.isArray(data.staff)
      ? (data.staff as { id: string; name: string })
      : null

    return NextResponse.json({
      token: data.token,
      patient_name: patient?.name || '',
      booking_type_id: data.booking_type_id,
      booking_type_name: bookingType?.display_name || '',
      duration_minutes: data.duration_minutes,
      staff_id: data.staff_id,
      staff_name: staff?.name || null,
      unit_number: data.unit_number,
      expires_at: data.expires_at,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
