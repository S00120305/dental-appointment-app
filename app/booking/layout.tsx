import type { Metadata, Viewport } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Web予約 | 金澤オーラルケアクリニック',
  description: '金澤オーラルケアクリニックのWeb予約ページです。24時間いつでもご予約いただけます。',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
}

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Noto Sans JP', 'Inter', sans-serif" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-white"
        style={{ borderBottom: '1px solid #B8923A' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-3">
          <Image
            src="/images/logo-booking.png"
            alt="金澤オーラルケアクリニック"
            width={240}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-white">
        {children}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#F8F5F0' }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <p className="text-sm font-medium" style={{ color: '#333333' }}>
            金澤オーラルケアクリニック
          </p>
          <p className="mt-1 text-xs" style={{ color: '#666666' }}>
            KANAZAWA ORAL CARE CLINIC
          </p>
          <div className="mt-3 space-y-1 text-xs" style={{ color: '#666666' }}>
            <p>〒920-0024 石川県金沢市西念3丁目1-32</p>
            <p>TEL: 076-256-5566</p>
            <p>診療時間: 9:00〜12:30 / 14:00〜18:00（日曜・祝日休診）</p>
          </div>
          <p className="mt-4 text-xs" style={{ color: '#999999' }}>
            &copy; {new Date().getFullYear()} Kanazawa Oral Care Clinic
          </p>
        </div>
      </footer>
    </div>
  )
}
