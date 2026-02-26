'use client'

import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/hooks/useAuth'

interface MenuItem {
  label: string
  description: string
  href: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
  adminOnly?: boolean
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    title: '医院設定',
    items: [
      {
        label: '医院情報',
        description: '医院電話番号など基本情報の設定',
        href: '/settings/clinic-info',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        label: '診察室設定',
        description: '表示する診察室数の設定',
        href: '/settings/units',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        ),
      },
      {
        label: '休診日設定',
        description: '定休曜日・祝日・特定休診日の管理',
        href: '/settings/holidays',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        label: '予約種別管理',
        description: '予約種別の追加・編集・Web予約設定',
        href: '/settings/booking-types',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
      },
      {
        label: '診療時間設定',
        description: '午前・午後の診療時間と昼休みの設定',
        href: '/settings/business-hours',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: '注意事項タグ',
        description: '予約に付ける注意フラグの管理',
        href: '/settings/appointment-tags',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'スタッフ',
    items: [
      {
        label: 'スタッフ表示設定',
        description: 'スタッフの色設定（追加・編集は在庫管理アプリから）',
        href: '/settings/staff',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        label: 'スタッフ休日管理',
        description: 'スタッフごとの有給・公休・半休の管理',
        href: '/settings/staff-holidays',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: '予約・通知',
    items: [
      {
        label: 'Web予約設定',
        description: '予約可能期間・締切・キャンセル期限の設定',
        href: '/settings/web-booking',
        iconBg: 'bg-cyan-100',
        iconColor: 'text-cyan-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        ),
      },
      {
        label: 'リマインド設定',
        description: 'SMS・メール通知のテンプレート設定',
        href: '/settings/reminders',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'データ管理',
    items: [
      {
        label: 'バックアップ',
        description: 'NASへのデータバックアップ管理',
        href: '/settings/backup',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        adminOnly: true,
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        ),
      },
      {
        label: 'CSVインポート',
        description: 'オプテックからの患者データ取り込み',
        href: '/settings/import',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
      },
      {
        label: '操作ログ',
        description: '予約・患者・設定の操作履歴を確認',
        href: '/settings/logs',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        label: '通知ログ',
        description: 'LINE・メール通知の送信履歴を確認',
        href: '/settings/notification-logs',
        iconBg: 'bg-pink-100',
        iconColor: 'text-pink-600',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'セキュリティ',
    items: [
      {
        label: 'パスワード変更',
        description: 'デバイス認証パスワードの変更',
        href: '/settings/password',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        adminOnly: true,
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      },
    ],
  },
]

export default function SettingsPage() {
  const { isAdmin } = useAuth()

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">設定</h1>

        <div className="space-y-8">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                {group.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((item) => {
                  const disabled = item.adminOnly && !isAdmin

                  if (disabled) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm opacity-50 cursor-not-allowed"
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                          <span className={item.iconColor}>{item.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.label}</h3>
                          <p className="mt-0.5 text-sm text-gray-400">管理者のみ操作可能です</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md active:bg-gray-50"
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                        <span className={item.iconColor}>{item.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.label}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
