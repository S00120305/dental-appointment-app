import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { recordLog } from '@/lib/log/record-log'

// POST: 予約キャンセル（公開API）
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 5, windowMs: 60_000, name: 'booking-cancel' })
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

    // 予約を取得
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id, start_time, duration_minutes, status, appointment_type, patient_id, booking_token,
        patient:patients!patient_id(id, name, email, phone, preferred_notification, line_user_id),
        booking_type:booking_types!left(display_name, duration_minutes)
      `)
      .eq('booking_token', token)
      .eq('is_deleted', false)
      .single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    // ステータスチェック
    if (appointment.status === 'cancelled') {
      return NextResponse.json({ error: 'この予約は既にキャンセル済みです' }, { status: 400 })
    }
    if (appointment.status !== 'scheduled' && appointment.status !== 'pending') {
      return NextResponse.json({ error: 'この予約はキャンセルできません' }, { status: 400 })
    }

    // 期限チェック
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

    if (!isWithinDeadline(appointment.start_time, cancelDeadlineTime)) {
      return NextResponse.json(
        {
          error: `変更・キャンセルの受付期限（前日${cancelDeadlineTime}）を過ぎています。お電話にてご連絡ください。`,
          clinic_phone: clinicPhone,
        },
        { status: 403 }
      )
    }

    // キャンセル実行
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', appointment.id)

    if (updateError) {
      return NextResponse.json({ error: 'キャンセルに失敗しました' }, { status: 500 })
    }

    // 患者情報
    const patient = appointment.patient && !Array.isArray(appointment.patient)
      ? (appointment.patient as { id: string; name: string; email: string | null; phone: string | null; preferred_notification: string; line_user_id: string | null })
      : null
    const bookingType = appointment.booking_type && !Array.isArray(appointment.booking_type)
      ? (appointment.booking_type as { display_name: string; duration_minutes: number })
      : null

    const typeName = bookingType?.display_name || appointment.appointment_type
    const dateFormatted = formatDateJP(appointment.start_time)
    const time = formatTime(appointment.start_time)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'

    // ログ記録
    await recordLog({
      userName: 'Web患者',
      actionType: 'cancel',
      targetType: 'appointment',
      targetId: appointment.id,
      summary: `Web患者がキャンセル: ${patient?.name || ''} ${dateFormatted} ${time} ${typeName}`,
      details: { booking_token: token, patient_name: patient?.name },
    })

    // 通知送信
    if (patient) {
      try {
        const preferredNotification = (patient.preferred_notification || 'none') as 'line' | 'email' | 'none'

        const lineMessage = `🦷 金澤オーラルケアクリニック\n\nご予約をキャンセルしました。\n\nキャンセル: ${dateFormatted} ${time}〜\n📋 ${typeName}\n\n再度のご予約はこちら:\n${appUrl}/booking`

        const emailMessage = `${patient.name}様\n\n以下のご予約をキャンセルしました。\n\n■ キャンセル済み\n日時: ${dateFormatted} ${time}〜\n内容: ${typeName}\n\n再度のご予約はこちら:\n${appUrl}/booking\n\n金澤オーラルケアクリニック${clinicPhone ? `\n${clinicPhone}` : ''}`

        const message = preferredNotification === 'line' ? lineMessage : emailMessage

        await sendNotification(
          {
            patientId: patient.id,
            email: patient.email,
            lineUserId: patient.line_user_id,
            preferredNotification,
          },
          message,
          'booking_cancel',
          appointment.id,
          '【金澤オーラルケアクリニック】ご予約キャンセルのお知らせ'
        )
      } catch (e) {
        console.error('キャンセル通知送信失敗:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

function formatDateJP(startTime: string): string {
  const d = new Date(startTime)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${y}年${m}月${day}日（${days[d.getDay()]}）`
}

function formatTime(startTime: string): string {
  const d = new Date(startTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
