import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase/server'

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

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

async function getFooterData() {
  try {
    const supabase = createServerClient()

    const [settingsRes, holidaysRes] = await Promise.all([
      supabase
        .from('appointment_settings')
        .select('key, value')
        .in('key', ['business_hours']),
      supabase
        .from('clinic_holidays')
        .select('holiday_type, day_of_week')
        .eq('holiday_type', 'weekly')
        .eq('is_active', true),
    ])

    let bhStart = '09:30'
    let bhEnd = '18:00'
    let lunchStart = '13:00'
    let lunchEnd = '14:00'

    if (settingsRes.data) {
      for (const row of settingsRes.data) {
        if (row.key === 'business_hours') {
          try {
            const bh = JSON.parse(row.value)
            bhStart = bh.start || '09:30'
            bhEnd = bh.end || '18:00'
            lunchStart = bh.lunch_start || '13:00'
            lunchEnd = bh.lunch_end || '14:00'
          } catch { /* ignore */ }
        }
      }
    }

    const closedDayNames: string[] = []
    if (holidaysRes.data) {
      const sorted = [...holidaysRes.data].sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0))
      for (const h of sorted) {
        if (h.day_of_week !== null && h.day_of_week >= 0 && h.day_of_week <= 6) {
          closedDayNames.push(DAY_NAMES[h.day_of_week])
        }
      }
    }

    const closedText = closedDayNames.length > 0
      ? `${closedDayNames.join('・')}曜・祝日休診`
      : '祝日休診'

    return {
      hoursText: `診療時間: ${bhStart}〜${lunchStart} / ${lunchEnd}〜${bhEnd}（${closedText}）`,
    }
  } catch {
    return {
      hoursText: '診療時間: 9:30〜13:00 / 14:00〜18:00（日曜・祝日休診）',
    }
  }
}

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { hoursText } = await getFooterData()

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
            <p>〒921-8148 石川県金沢市額新保2-272番地</p>
            <p>TEL: 076-256-5566</p>
            <p>{hoursText}</p>
          </div>
          <p className="mt-4 text-xs" style={{ color: '#999999' }}>
            &copy; {new Date().getFullYear()} Kanazawa Oral Care Clinic
          </p>
        </div>
      </footer>
    </div>
  )
}
