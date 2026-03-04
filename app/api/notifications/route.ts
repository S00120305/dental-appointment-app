import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { formatPatientName } from '@/lib/utils/patient-name'
import { sendSMS, isSMSConfigured } from '@/lib/notifications/sms'
import { sendEmail, isEmailConfigured } from '@/lib/notifications/email'
import { renderTemplate, DEFAULT_SMS_TEMPLATE, DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_SUBJECT } from '@/lib/notifications/template'

// POST: リマインド通知送信（cron から呼ばれる）
export async function POST(request: NextRequest) {
  // 認証チェック（CRON_SECRET 未設定時も拒否）
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 環境変数チェック
  if (!isSMSConfigured() && !isEmailConfigured()) {
    return NextResponse.json(
      { error: '通知機能が設定されていません。TWILIO または RESEND の環境変数を設定してください。' },
      { status: 503 }
    )
  }

  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const isTest = body.test === true
    const testPhone = body.test_phone as string | undefined
    const testEmail = body.test_email as string | undefined

    // テスト送信モード
    if (isTest) {
      return await handleTestSend(supabase, testPhone, testEmail)
    }

    // 設定取得
    const settings = await getSettings(supabase)

    // 翌日の予約を取得
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDateISO(tomorrow)

    const dayStart = `${tomorrowStr}T00:00:00+09:00`
    const dayEnd = `${tomorrowStr}T23:59:59+09:00`

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id, start_time, appointment_type,
        patient:patients!patient_id(id, last_name, first_name, phone, email, reminder_sms, reminder_email)
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

    // 送信済みチェック用: 本日の送信ログを取得
    const todayStr = formatDateISO(new Date())
    const { data: existingLogs } = await supabase
      .from('notification_logs')
      .select('appointment_id, type')
      .gte('sent_at', `${todayStr}T00:00:00+09:00`)
      .eq('status', 'sent')

    const sentSet = new Set(
      (existingLogs || []).map(l => `${l.appointment_id}_${l.type}`)
    )

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const appt of appointments) {
      const patientRaw = appt.patient as unknown
      const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
        id: string; last_name: string; first_name: string; phone: string | null;
        email: string | null; reminder_sms: boolean; reminder_email: boolean
      } | null

      if (!patient) continue

      const startDate = new Date(appt.start_time)
      const vars = {
        patient_name: formatPatientName(patient.last_name, patient.first_name),
        date: formatDateJP(startDate),
        time: formatTimeJP(startDate),
        type: appt.appointment_type,
      }

      // SMS 送信
      if (patient.reminder_sms && patient.phone && isSMSConfigured()) {
        const key = `${appt.id}_sms`
        if (sentSet.has(key)) {
          skipped++
        } else {
          const message = renderTemplate(settings.smsTemplate, vars)
          const result = await sendSMS(patient.phone, message)
          await logNotification(supabase, appt.id, patient.id, 'sms', result)
          if (result.success) sent++
          else failed++
        }
      }

      // メール送信
      if (patient.reminder_email && patient.email && isEmailConfigured()) {
        const key = `${appt.id}_email`
        if (sentSet.has(key)) {
          skipped++
        } else {
          const message = renderTemplate(settings.emailTemplate, vars)
          const result = await sendEmail(patient.email, DEFAULT_EMAIL_SUBJECT, message)
          await logNotification(supabase, appt.id, patient.id, 'email', result)
          if (result.success) sent++
          else failed++
        }
      }
    }

    return NextResponse.json({
      message: `通知送信完了: ${sent}件送信, ${skipped}件スキップ, ${failed}件失敗`,
      sent,
      skipped,
      failed,
      total: appointments.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// テスト送信
async function handleTestSend(
  supabase: ReturnType<typeof createServerClient>,
  testPhone?: string,
  testEmail?: string,
) {
  const settings = await getSettings(supabase)
  const vars = {
    patient_name: 'テスト患者',
    date: '2月24日',
    time: '10:00',
    type: '定期検診',
  }

  const results: { sms?: { success: boolean; error?: string }; email?: { success: boolean; error?: string } } = {}

  if (testPhone && isSMSConfigured()) {
    const message = renderTemplate(settings.smsTemplate, vars)
    results.sms = await sendSMS(testPhone, message)
  }

  if (testEmail && isEmailConfigured()) {
    const message = renderTemplate(settings.emailTemplate, vars)
    results.email = await sendEmail(testEmail, DEFAULT_EMAIL_SUBJECT, message)
  }

  if (!results.sms && !results.email) {
    return NextResponse.json(
      { error: 'テスト送信先（電話番号またはメールアドレス）を指定してください' },
      { status: 400 }
    )
  }

  return NextResponse.json({ test: true, results })
}

// 設定取得
async function getSettings(supabase: ReturnType<typeof createServerClient>) {
  const { data } = await supabase
    .from('appointment_settings')
    .select('key, value')
    .in('key', ['reminder_time', 'reminder_sms_template', 'reminder_email_template'])

  const settingsMap: Record<string, string> = {}
  for (const row of data || []) {
    settingsMap[row.key] = row.value
  }

  return {
    reminderTime: settingsMap.reminder_time || '18:00',
    smsTemplate: settingsMap.reminder_sms_template || DEFAULT_SMS_TEMPLATE,
    emailTemplate: settingsMap.reminder_email_template || DEFAULT_EMAIL_TEMPLATE,
  }
}

// 通知ログ記録
async function logNotification(
  supabase: ReturnType<typeof createServerClient>,
  appointmentId: string,
  patientId: string,
  type: 'sms' | 'email',
  result: { success: boolean; error?: string },
) {
  await supabase.from('notification_logs').insert({
    appointment_id: appointmentId,
    patient_id: patientId,
    type,
    status: result.success ? 'sent' : 'failed',
    error_message: result.error || null,
  })
}

// ヘルパー
function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateJP(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatTimeJP(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
