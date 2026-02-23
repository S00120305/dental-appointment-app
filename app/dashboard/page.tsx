'use client'

import AppLayout from '@/components/layout/AppLayout'

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-gray-500">本日の予約</h2>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="mt-1 text-xs text-gray-400">準備中</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-gray-500">技工物アラート</h2>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="mt-1 text-xs text-gray-400">準備中</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-gray-500">在庫アラート</h2>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="mt-1 text-xs text-gray-400">準備中</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
