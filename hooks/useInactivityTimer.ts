'use client'

import { useEffect, useCallback, useRef } from 'react'
import { updateLastActivity, getInactivityTimeout } from '@/lib/auth/session'

interface UseInactivityTimerOptions {
  onTimeout: () => void
  enabled: boolean
}

export function useInactivityTimer({ onTimeout, enabled }: UseInactivityTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (!enabled) return

    updateLastActivity()

    timerRef.current = setTimeout(() => {
      onTimeout()
    }, getInactivityTimeout())
  }, [onTimeout, enabled])

  useEffect(() => {
    if (!enabled) return

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']

    const handleActivity = () => {
      resetTimer()
    }

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    resetTimer()

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [resetTimer, enabled])
}
