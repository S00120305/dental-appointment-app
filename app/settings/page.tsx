'use client'

import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'

const settingsItems = [
  { href: '/settings/clinic-info', label: '医院情報', description: '医院電話番号など基本情報の設定' },
  { href: '/settings/staff', label: 'スタッフ管理', description: 'スタッフの追加・編集・PIN管理' },
  { href: '/settings/holidays', label: '休診日設定', description: '定休曜日・祝日・特定休診日の管理' },
  { href: '/settings/staff-holidays', label: 'スタッフ休日管理', description: 'スタッフごとの有給・公休・半休の管理' },
  { href: '/settings/units', label: '診察室設定', description: '表示する診察室数の設定' },
  { href: '/settings/booking-types', label: '予約種別管理', description: '予約種別の追加・編集・Web予約設定' },
  { href: '/settings/web-booking', label: 'Web予約設定', description: '予約可能期間・締切・キャンセル期限の設定' },
  { href: '/settings/reminders', label: 'リマインド設定', description: 'SMS・メール通知のテンプレート設定' },
  { href: '/settings/import', label: 'CSVインポート', description: 'オプテックからの患者データ取り込み' },
  { href: '/settings/logs', label: '操作ログ', description: '予約・患者・設定の操作履歴を確認' },
  { href: '/settings/notification-logs', label: '通知ログ', description: 'LINE・メール通知の送信履歴を確認' },
]

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">設定</h1>
        <div className="space-y-2">
          {settingsItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-gray-900">{item.label}</h2>
                  <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
