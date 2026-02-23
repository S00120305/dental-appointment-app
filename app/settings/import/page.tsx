'use client'

import AppLayout from '@/components/layout/AppLayout'

export default function ImportPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">CSVインポート</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">CSVインポート（準備中）</p>
        </div>
      </div>
    </AppLayout>
  )
}
