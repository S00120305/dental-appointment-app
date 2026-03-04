'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/hooks/useAuth'

export default function Header() {
  const router = useRouter()
  const { session, logout } = useAuth()

  // 承認待ちWeb予約件数
  const { data: pendingData } = useSWR<{ count: number }>(
    session ? '/api/appointments?status=pending&booking_source=web&count_only=true' : null,
    (url: string) => fetch(url).then(r => r.json()),
    { refreshInterval: 60000, dedupingInterval: 60000 }
  )
  const pendingCount = pendingData?.count || 0

  const handleLogout = async () => {
    await logout()
    router.push('/pin')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <div className="min-w-0 flex-1">
          <Link href="/appointments" className="block truncate transition-colors hover:text-emerald-600">
            <span className="text-sm font-bold text-gray-900 sm:text-lg">金澤オーラルケアクリニック</span>
            <span className="ml-2 text-xs text-gray-500">予約管理</span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* 承認待ちバッジ */}
          {pendingCount > 0 && (
            <Link
              href="/appointments/pending"
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 sm:px-3 sm:text-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              承認待ち {pendingCount}
            </Link>
          )}

          {/* バックアップ */}
          <Link
            href="/settings/backup"
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 sm:px-3 sm:text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0-3-3m3 3 3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
            <span className="hidden sm:inline">バックアップ</span>
          </Link>

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
