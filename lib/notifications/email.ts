import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

export function isEmailConfigured(): boolean {
  return !!apiKey
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'メール設定が未完了です' }
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      text: body,
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'メール送信に失敗しました'
    return { success: false, error: message }
  }
}
