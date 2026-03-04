// サーバーサイド PINセッショントークン（HMAC-SHA256署名）
// API Routes (Node.js runtime) で使用

import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_MAX_AGE = 30 * 60 * 1000 // 30分（ミリ秒）

export const PIN_SESSION_COOKIE = 'pin_session'
export const PIN_SESSION_MAX_AGE = 30 * 60 // 30分（秒）

interface SessionPayload {
  u: string // userId
  n: string // userName
  a: boolean // isAdmin
  e: number // expiry timestamp (ms)
}

function getSecret(): string {
  // 専用の署名キーを優先。未設定時はservice_role_keyにフォールバック
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is not set')
  return secret
}

/**
 * HMAC-SHA256署名付きセッショントークンを生成
 * フォーマット: base64(payload).base64(signature)
 */
export function generateSessionToken(userId: string, userName: string, isAdmin: boolean): string {
  const payload: SessionPayload = {
    u: userId,
    n: userName,
    a: isAdmin,
    e: Date.now() + SESSION_MAX_AGE,
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = createHmac('sha256', getSecret())
    .update(payloadStr)
    .digest('base64')
  return `${payloadStr}.${signature}`
}

/**
 * セッショントークンを検証し、ペイロードを返す
 * 無効または期限切れの場合はnullを返す
 */
export function verifySessionToken(
  token: string
): { userId: string; userName: string; isAdmin: boolean; exp: number } | null {
  try {
    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return null

    const payloadStr = token.slice(0, dotIndex)
    const signature = token.slice(dotIndex + 1)

    // HMAC検証（タイミングセーフ）
    const expected = createHmac('sha256', getSecret())
      .update(payloadStr)
      .digest('base64')

    const sigBuf = Buffer.from(signature, 'base64')
    const expBuf = Buffer.from(expected, 'base64')

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    // ペイロードをデコード
    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64').toString()
    )

    // 有効期限チェック
    if (Date.now() > payload.e) return null

    return { userId: payload.u, userName: payload.n, isAdmin: !!payload.a, exp: payload.e }
  } catch {
    return null
  }
}
