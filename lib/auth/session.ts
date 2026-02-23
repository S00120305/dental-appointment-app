// PINセッション管理（クライアントサイド）
// sessionStorageを使用し、ブラウザを閉じるとセッションが破棄される

const SESSION_KEY = 'pin_session'
const LAST_ACTIVITY_KEY = 'last_activity'
const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30分（ミリ秒）

export interface PinSession {
  userId: string
  userName: string
  isAdmin: boolean
  authenticatedAt: number
}

export function setPinSession(userId: string, userName: string, isAdmin: boolean): void {
  const session: PinSession = {
    userId,
    userName,
    isAdmin,
    authenticatedAt: Date.now(),
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  updateLastActivity()
}

export function getPinSession(): PinSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const session: PinSession = JSON.parse(raw)

    // 無操作タイムアウトチェック
    const lastActivity = getLastActivity()
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
      clearPinSession()
      return null
    }

    return session
  } catch {
    clearPinSession()
    return null
  }
}

export function clearPinSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function updateLastActivity(): void {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
}

function getLastActivity(): number | null {
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY)
  return raw ? parseInt(raw, 10) : null
}

export function getInactivityTimeout(): number {
  return INACTIVITY_TIMEOUT
}
