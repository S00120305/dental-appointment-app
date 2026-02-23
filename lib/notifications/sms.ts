import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

export function isSMSConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber)
}

// 日本の電話番号を E.164 形式に変換
// 090-1234-5678 → +819012345678
export function formatPhoneNumber(phone: string): string {
  // ハイフン・スペース・カッコを除去
  const cleaned = phone.replace(/[\s\-()]/g, '')

  // 既に + で始まっている場合はそのまま
  if (cleaned.startsWith('+')) return cleaned

  // 0 で始まる場合は +81 に置換
  if (cleaned.startsWith('0')) {
    return '+81' + cleaned.slice(1)
  }

  // その他はそのまま（+81 を付与）
  return '+81' + cleaned
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!isSMSConfigured()) {
    return { success: false, error: 'SMS設定が未完了です' }
  }

  try {
    const client = twilio(accountSid, authToken)
    await client.messages.create({
      body,
      from: fromNumber,
      to: formatPhoneNumber(to),
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMS送信に失敗しました'
    return { success: false, error: message }
  }
}
