import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { renderTemplate, DEFAULT_SMS_TEMPLATE, DEFAULT_EMAIL_SUBJECT } from '@/lib/notifications/template'
import { formatPatientName } from '@/lib/utils/patient-name'

// POST /api/notifications/reminder
// 翌日の予約に対してリマインド通知を送信する
// Vercel Cron Jobs から毎日 JST 18:00 (UTC 09:00) に呼び出される
export async function POST(request: NextRequest) {
  // CRON_SECRET で認証（未設定時も拒否）
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // 翌日の予約を取得
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDateISO(tomorrow)

    const dayStart = `${tomorrowStr}T00:00:00+09:00`
    const dayEnd = `${tomorrowStr}T23:59:59+09:00`

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id, start_time, appointment_type, booking_token,
        patient:patients!patient_id(id, last_name, first_name, phone, email, line_user_id, preferred_notification)
      `)
      .eq('is_deleted', false)
      .eq('status', 'scheduled')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: '翌日の通知対象予約はありません', sent: 0, skipped: 0, failed: 0 })
    }

    // 送信済みチェック用: 本日のリマインドログを取得
    const todayStr = formatDateISO(new Date())
    const { data: existingLogs } = await supabase
      .from('notification_logs')
      .select('appointment_id')
      .eq('type', 'reminder')
      .eq('status', 'sent')
      .gte('created_at', `${todayStr}T00:00:00+09:00`)

    const sentSet = new Set(
      (existingLogs || []).map(l => l.appointment_id)
    )

    // テンプレート取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['reminder_sms_template', 'reminder_email_template'])

    const settingsMap: Record<string, string> = {}
    for (const row of settingsData || []) {
      settingsMap[row.key] = row.value
    }
    const messageTemplate = settingsMap.reminder_sms_template || DEFAULT_SMS_TEMPLATE

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const appt of appointments) {
      // 重複送信防止
      if (sentSet.has(appt.id)) {
        skipped++
        continue
      }

      const patientRaw = appt.patient as unknown
      const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
        id: string; last_name: string; first_name: string; phone: string | null
        email: string | null; line_user_id: string | null
        preferred_notification: string
      } | null

      if (!patient) { skipped++; continue }
      if (patient.preferred_notification === 'none') { skipped++; continue }

      const startDate = new Date(appt.start_time)
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][startDate.getDay()]

      const vars = {
        patient_name: formatPatientName(patient.last_name, patient.first_name),
        date: `${startDate.getMonth() + 1}/${startDate.getDate()}(${dayOfWeek})`,
        time: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
        type: appt.appointment_type,
      }

      // メッセージ組み立て
      let message = renderTemplate(messageTemplate, vars)

      // booking_token がある場合はリンクを追加
      if (appt.booking_token) {
        message += `\n\n変更・キャンセルは下記から:\n${appUrl}/booking/confirm/${appt.booking_token}`
      }

      const result = await sendNotification(
        {
          patientId: patient.id,
          email: patient.email,
          lineUserId: patient.line_user_id,
          preferredNotification: patient.preferred_notification as 'line' | 'email' | 'none',
        },
        message,
        'reminder',
        appt.id,
        DEFAULT_EMAIL_SUBJECT
      )

      if (result.success) sent++
      else failed++
    }

    // 期限切れトークンを expired に更新
    let expiredTokens = 0
    try {
      const { data: expiredData } = await supabase
        .from('booking_tokens')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('status', 'unused')
        .lt('expires_at', new Date().toISOString())
        .select('id')

      expiredTokens = expiredData?.length || 0
    } catch (e) {
      console.error('トークン期限切れ更新エラー:', e)
    }

    return NextResponse.json({
      message: `リマインド通知完了: ${sent}件送信, ${skipped}件スキップ, ${failed}件失敗, トークン期限切れ: ${expiredTokens}件`,
      sent,
      skipped,
      failed,
      total: appointments.length,
      expired_tokens: expiredTokens,
    })
  } catch (e) {
    console.error('リマインド通知エラー:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
