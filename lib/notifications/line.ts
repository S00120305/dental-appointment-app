import crypto from 'crypto'

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''

export function isLineConfigured(): boolean {
  return !!CHANNEL_ACCESS_TOKEN
}

export async function sendLineMessage(
  lineUserId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!isLineConfigured()) {
    return { success: false, error: 'LINE設定が未完了です' }
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error)
    }

    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'LINE送信に失敗しました'
    console.error('LINE送信エラー:', message)
    return { success: false, error: message }
  }
}

// Reply API（Webhook応答用）
export async function replyLineMessage(
  replyToken: string,
  message: string
): Promise<void> {
  if (!isLineConfigured()) return

  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: message }],
      }),
    })
  } catch (e) {
    console.error('LINE Reply エラー:', e)
  }
}

// LINE プロフィール取得
export async function getLineProfile(
  lineUserId: string
): Promise<{ displayName: string } | null> {
  if (!isLineConfigured()) return null

  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    })
    if (!response.ok) return null
    const data = await response.json()
    return { displayName: data.displayName }
  } catch {
    return null
  }
}

// Webhook 署名検証
export function verifyLineSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET || ''
  if (!channelSecret) return false
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')
  return hash === signature
}
