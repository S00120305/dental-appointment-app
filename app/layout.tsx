import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: '予約・来院管理',
  description: '歯科医院 予約・来院管理アプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
