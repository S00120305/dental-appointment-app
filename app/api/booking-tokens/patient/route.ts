import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// GET: 患者のトークン一覧（公開API、診察券番号+電話番号で認証）
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 10, windowMs: 60_000, name: 'booking-token-patient' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。' },
        { status: 429 }
      )
    }

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const chartNumber = searchParams.get('chart_number')
    const phone = searchParams.get('phone')

    if (!chartNumber || !phone) {
      return NextResponse.json({ error: '診察券番号と電話番号は必須です' }, { status: 400 })
    }

    const phoneClean = phone.replace(/[-\s]/g, '')

    // 患者検索
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name')
      .eq('chart_number', chartNumber.trim())
      .eq('phone', phoneClean)
      .eq('is_active', true)
      .maybeSingle()

    if (patientError || !patient) {
      return NextResponse.json({ error: '該当する患者が見つかりません' }, { status: 404 })
    }

    // 未使用トークン一覧
    const { data: tokens } = await supabase
      .from('booking_tokens')
      .select(`
        id, token, duration_minutes, status, expires_at,
        booking_type:booking_types!booking_type_id(id, display_name),
        staff:users!staff_id(id, name)
      `)
      .eq('patient_id', patient.id)
      .eq('status', 'unused')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    // 予約一覧（今日以降のスケジュール済み）
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00+09:00`

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, start_time, duration_minutes, status, booking_token,
        appointment_type
      `)
      .eq('patient_id', patient.id)
      .eq('is_deleted', false)
      .in('status', ['scheduled', 'pending'])
      .gte('start_time', todayStr)
      .order('start_time', { ascending: true })

    return NextResponse.json({
      patient_name: patient.name,
      tokens: (tokens || []).map(t => {
        const bt = t.booking_type && !Array.isArray(t.booking_type)
          ? (t.booking_type as { id: string; display_name: string })
          : null
        const staff = t.staff && !Array.isArray(t.staff)
          ? (t.staff as { id: string; name: string })
          : null
        return {
          token: t.token,
          booking_type_name: bt?.display_name || '',
          duration_minutes: t.duration_minutes,
          staff_name: staff?.name || null,
          expires_at: t.expires_at,
        }
      }),
      appointments: (appointments || []).map(a => ({
        id: a.id,
        start_time: a.start_time,
        duration_minutes: a.duration_minutes,
        status: a.status,
        appointment_type: a.appointment_type,
        booking_token: a.booking_token,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
