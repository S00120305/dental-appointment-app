import { sendEmail } from './email'
import { sendLineMessage } from './line'
import { createServerClient } from '@/lib/supabase/server'

interface NotificationTarget {
  patientId: string
  email?: string | null
  lineUserId?: string | null
  preferredNotification: 'line' | 'email' | 'none'
  // 将来: | 'sms' と phone フィールドを追加
}

interface SendResult {
  channel: string
  success: boolean
  error?: string
}

export async function sendNotification(
  target: NotificationTarget,
  message: string,
  type: string,
  appointmentId?: string,
  emailSubject?: string
): Promise<SendResult> {
  // 通知不要
  if (target.preferredNotification === 'none') {
    return { channel: 'none', success: true }
  }

  // 優先チャネルで送信を試みる。失敗したらフォールバック。
  const channels = getChannelOrder(target)

  let result: SendResult | null = null

  for (const channel of channels) {
    if (channel === 'line' && target.lineUserId) {
      const res = await sendLineMessage(target.lineUserId, message)
      result = { channel: 'line', ...res }
    } else if (channel === 'email' && target.email) {
      const res = await sendEmail(
        target.email,
        emailSubject || '【おーるけあ歯科】お知らせ',
        message
      )
      result = { channel: 'email', ...res }
    } else {
      continue
    }

    // ログ記録
    await logNotification({
      patientId: target.patientId,
      appointmentId,
      channel: result.channel,
      type,
      status: result.success ? 'sent' : 'failed',
      content: message,
      errorMessage: result.error,
    })

    if (result.success) return result
    // 失敗したら次のチャネルにフォールバック
  }

  return result || { channel: 'none', success: false, error: '送信可能なチャネルがありません' }
}

function getChannelOrder(target: NotificationTarget): string[] {
  const preferred = target.preferredNotification
  const all = ['line', 'email']
  // 将来: const all = ['line', 'sms', 'email']
  return [preferred, ...all.filter(c => c !== preferred)]
}

async function logNotification(entry: {
  patientId: string
  appointmentId?: string
  channel: string
  type: string
  status: string
  content: string
  errorMessage?: string
}) {
  try {
    const supabase = createServerClient()
    await supabase.from('notification_logs').insert({
      patient_id: entry.patientId,
      appointment_id: entry.appointmentId || null,
      channel: entry.channel,
      type: entry.type,
      status: entry.status,
      content: entry.content,
      error_message: entry.errorMessage || null,
    })
  } catch (e) {
    console.error('通知ログ記録失敗:', e)
  }
}
