'use client'

import AuthGuard from './AuthGuard'
import Header from './Header'
import Navigation from './Navigation'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Navigation />
        {/* メインコンテンツ: デスクトップではサイドバー分のマージン、モバイルではボトムナビ分のパディング */}
        <main className="pb-24 lg:ml-56 lg:pb-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
