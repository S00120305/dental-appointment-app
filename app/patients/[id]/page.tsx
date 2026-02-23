'use client'

import AppLayout from '@/components/layout/AppLayout'

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">患者詳細</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">患者詳細（準備中）</p>
          <p className="mt-2 text-sm text-gray-400">患者ID: {params.id}</p>
        </div>
      </div>
    </AppLayout>
  )
}
