'use client'

import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/hooks/useAuth'

interface SettingsItem {
  href: string
  label: string
  description: string
}

interface SettingsGroup {
  title: string
  items: SettingsItem[]
  adminOnly?: boolean
}

const settingsGroups: SettingsGroup[] = [
  {
    title: '医院設定',
    items: [
      { href: '/settings/clinic-info', label: '医院情報', description: '医院電話番号など基本情報の設定' },
      { href: '/settings/units', label: '診察室設定', description: '表示する診察室数の設定' },
      { href: '/settings/holidays', label: '休診日設定', description: '定休曜日・祝日・特定休診日の管理' },
      { href: '/settings/booking-types', label: '予約種別管理', description: '予約種別の追加・編集・Web予約設定' },
    ],
  },
  {
    title: 'スタッフ',
    items: [
      { href: '/settings/staff', label: 'スタッフ表示設定', description: 'スタッフの色設定（追加・編集は在庫管理アプリから）' },
      { href: '/settings/staff-holidays', label: 'スタッフ休日管理', description: 'スタッフごとの有給・公休・半休の管理' },
    ],
  },
  {
    title: '予約・通知',
    items: [
      { href: '/settings/web-booking', label: 'Web予約設定', description: '予約可能期間・締切・キャンセル期限の設定' },
      { href: '/settings/reminders', label: 'リマインド設定', description: 'SMS・メール通知のテンプレート設定' },
    ],
  },
  {
    title: 'データ管理',
    items: [
      { href: '/settings/backup', label: 'バックアップ', description: 'NASへのデータバックアップ管理' },
      { href: '/settings/import', label: 'CSVインポート', description: 'オプテックからの患者データ取り込み' },
      { href: '/settings/logs', label: '操作ログ', description: '予約・患者・設定の操作履歴を確認' },
      { href: '/settings/notification-logs', label: '通知ログ', description: 'LINE・メール通知の送信履歴を確認' },
    ],
  },
  {
    title: 'セキュリティ',
    adminOnly: true,
    items: [
      { href: '/settings/password', label: 'パスワード変更', description: 'デバイス認証パスワードの変更' },
    ],
  },
]

export default function SettingsPage() {
  const { isAdmin } = useAuth()

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">設定</h1>
        <div className="space-y-6">
          {settingsGroups
            .filter((group) => !group.adminOnly || isAdmin)
            .map((group) => (
            <div key={group.title}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                {group.title}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{item.label}</h3>
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
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
