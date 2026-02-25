'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Header() {
  const router = useRouter()
  const { session, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push('/pin')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <div className="min-w-0 flex-1">
          <Link href="/dashboard" className="block truncate transition-colors hover:text-emerald-600">
            <span className="text-sm font-bold text-gray-900 sm:text-lg">金澤オーラルケアクリニック</span>
            <span className="ml-2 text-xs text-gray-500">予約管理</span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* 在庫管理アプリへのリンク */}
          <a
            href="https://app.oralcare-kanazawa.clinic"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 sm:flex sm:px-3 sm:text-sm"
          >
            在庫管理
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {session && (
            <>
              <span className="text-xs text-gray-600 sm:text-sm">
                {session.userName}
              </span>
              <button
                onClick={handleLogout}
                className="min-h-[44px] min-w-[44px] whitespace-nowrap rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                ログアウト
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
