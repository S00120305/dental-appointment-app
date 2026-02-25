'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { useToast } from '@/components/ui/Toast'

export default function PasswordChangePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('現在のパスワードを入力してください')
      return
    }

    if (!newPassword) {
      setError('新しいパスワードを入力してください')
      return
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません')
      return
    }

    setIsSaving(true)

    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'パスワードの変更に失敗しました')
        return
      }

      showToast('パスワードを変更しました。全デバイスで次回アクセス時に再認証が必要になります', 'success')
      setTimeout(() => router.push('/settings'), 2000)
    } catch {
      setError('パスワードの変更に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">パスワード変更</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                現在のパスワード
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-gray-500">8文字以上</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            パスワード変更後、全デバイスで次回アクセス時に再認証が必要になります。
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/settings')}
              className="min-h-[44px] flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? '変更中...' : '変更する'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
