'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useInactivityTimer } from '@/hooks/useInactivityTimer'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { session, isLoading, isAuthenticated, logout, checkSession } = useAuth()

  // 30分無操作タイムアウト
  useInactivityTimer({
    onTimeout: () => {
      logout()
      router.push('/pin')
    },
    enabled: isAuthenticated,
  })

  // 定期的にセッションの有効期限をチェック（1分ごと）
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      const current = checkSession()
      if (!current) {
        router.push('/pin')
      }
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, checkSession, router])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/pin')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
