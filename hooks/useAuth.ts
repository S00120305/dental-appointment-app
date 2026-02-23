'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getPinSession,
  clearPinSession,
  updateLastActivity,
  type PinSession,
} from '@/lib/auth/session'

export function useAuth() {
  const [session, setSession] = useState<PinSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkSession = useCallback(() => {
    const current = getPinSession()
    setSession(current)
    setIsLoading(false)
    return current
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ネットワークエラーでもクライアント側はクリアする
    }
    clearPinSession()
    setSession(null)
  }, [])

  const refreshActivity = useCallback(() => {
    updateLastActivity()
  }, [])

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    isAdmin: session?.isAdmin ?? false,
    logout,
    refreshActivity,
    checkSession,
  }
}
