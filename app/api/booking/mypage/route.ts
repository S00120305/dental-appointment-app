import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// POST: マイページ認証（診察券番号＋電話番号）
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 10, windowMs: 60_000, name: 'booking-mypage' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { chart_number, phone } = body

    if (!chart_number?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: '診察券番号と電話番号は必須です' },
        { status: 400 }
      )
    }

    const phoneClean = phone.replace(/[-\s]/g, '')

    const supabase = createServerClient()

    // 患者検索（chart_number + phone の完全一致）
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, chart_number, phone, email, preferred_notification, line_user_id')
      .eq('chart_number', chart_number.trim())
      .eq('phone', phoneClean)
      .eq('is_active', true)
      .maybeSingle()

    if (patientError || !patient) {
      return NextResponse.json(
        { error: '該当する患者情報が見つかりません。診察券番号と電話番号をご確認ください。' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // 今後の予約（scheduled + pending）、キャンセル除外
    const { data: upcomingAppointments } = await supabase
      .from('appointments')
      .select(`
        id, start_time, duration_minutes, status, appointment_type, booking_token,
        booking_type:booking_types!left(display_name)
      `)
      .eq('patient_id', patient.id)
      .eq('is_deleted', false)
      .in('status', ['scheduled', 'pending'])
      .gte('start_time', now)
      .order('start_time', { ascending: true })

    // 過去の予約（直近5件、completed のみ）
    const { data: pastAppointments } = await supabase
      .from('appointments')
      .select('id, start_time, duration_minutes, status, appointment_type')
      .eq('patient_id', patient.id)
      .eq('is_deleted', false)
      .eq('status', 'completed')
      .lt('start_time', now)
      .order('start_time', { ascending: false })
      .limit(5)

    // 未使用トークン
    const { data: unusedTokens } = await supabase
      .from('booking_tokens')
      .select(`
        token, duration_minutes, expires_at,
        booking_type:booking_types!left(display_name)
      `)
      .eq('patient_id', patient.id)
      .eq('status', 'unused')
      .gt('expires_at', now)
      .order('expires_at', { ascending: true })

    // 変更・キャンセル期限を取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['web_cancel_deadline_time', 'clinic_phone'])

    let cancelDeadlineTime = '18:00'
    let clinicPhone = ''
    if (settingsData) {
      for (const row of settingsData) {
        if (row.key === 'web_cancel_deadline_time') cancelDeadlineTime = row.value
        if (row.key === 'clinic_phone') clinicPhone = row.value
      }
    }

    // レスポンス構築
    const upcoming = (upcomingAppointments || []).map(a => {
      const bt = a.booking_type && !Array.isArray(a.booking_type)
        ? (a.booking_type as { display_name: string })
        : null
      return {
        id: a.id,
        start_time: a.start_time,
        duration_minutes: a.duration_minutes,
        status: a.status,
        appointment_type: bt?.display_name || a.appointment_type,
        booking_token: a.booking_token,
        can_change: isWithinDeadline(a.start_time, cancelDeadlineTime),
      }
    })

    const tokens = (unusedTokens || []).map(t => {
      const bt = t.booking_type && !Array.isArray(t.booking_type)
        ? (t.booking_type as { display_name: string })
        : null
      return {
        token: t.token,
        booking_type_name: bt?.display_name || '',
        duration_minutes: t.duration_minutes,
        expires_at: t.expires_at,
      }
    })

    const past = (pastAppointments || []).map(a => ({
      id: a.id,
      start_time: a.start_time,
      duration_minutes: a.duration_minutes,
      appointment_type: a.appointment_type,
    }))

    return NextResponse.json({
      patient: { name: patient.name },
      upcoming_appointments: upcoming,
      unused_tokens: tokens,
      past_appointments: past,
      cancel_deadline_time: cancelDeadlineTime,
      clinic_phone: clinicPhone,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 予約が変更・キャンセル期限内かチェック
 * 期限: 予約日の前日 {deadlineTime} まで
 */
function isWithinDeadline(startTime: string, deadlineTime: string): boolean {
  // 予約日のJST日付を取得（サーバーがUTCでも正しく動作）
  const apptDate = new Date(startTime)
  const jstMs = apptDate.getTime() + 9 * 60 * 60 * 1000
  const jstDateStr = new Date(jstMs).toISOString().split('T')[0]
  // 前日の期限時刻をJST固定で構築
  const deadline = new Date(`${jstDateStr}T${deadlineTime}:00+09:00`)
  deadline.setTime(deadline.getTime() - 24 * 60 * 60 * 1000)

  return new Date() < deadline
}
