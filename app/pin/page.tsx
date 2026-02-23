'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NumericKeypad from '@/components/ui/NumericKeypad'
import { setPinSession } from '@/lib/auth/session'

interface StaffUser {
  id: string
  name: string
  sort_order: number
}

export default function PinPage() {
  const router = useRouter()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; remainingSeconds: number } | null>(null)

  // スタッフ一覧を取得
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (res.ok) {
          setUsers(data.users)
        }
      } catch {
        setError('スタッフ一覧の取得に失敗しました')
      } finally {
        setIsLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  // ロックタイマー
  useEffect(() => {
    if (!lockInfo?.locked || lockInfo.remainingSeconds <= 0) return

    const timer = setInterval(() => {
      setLockInfo((prev) => {
        if (!prev || prev.remainingSeconds <= 1) {
          return null
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [lockInfo?.locked, lockInfo?.remainingSeconds])

  const handleSelectUser = (user: StaffUser) => {
    setSelectedUser(user)
    setPin('')
    setError('')
    setLockInfo(null)
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPin('')
    setError('')
    setLockInfo(null)
  }

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + key)
      setError('')
    }
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
    setError('')
  }

  const handleSubmit = useCallback(async () => {
    if (!selectedUser || pin.length !== 4) return

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
      })

      const data = await res.json()

      if (res.status === 423) {
        setLockInfo({ locked: true, remainingSeconds: data.remainingSeconds })
        setPin('')
        setError(data.error)
        return
      }

      if (!res.ok) {
        setError(data.error || 'PINが正しくありません')
        if (data.remainingAttempts !== undefined) {
          setError(`PINが正しくありません（残り${data.remainingAttempts}回）`)
        }
        setPin('')
        return
      }

      // 認証成功
      setPinSession(data.user.id, data.user.name, !!data.user.isAdmin)
      router.push('/dashboard')
    } catch {
      setError('通信エラーが発生しました')
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }, [selectedUser, pin, router])

  // 4桁入力で自動送信
  useEffect(() => {
    if (pin.length === 4 && selectedUser && !isLoading) {
      handleSubmit()
    }
  }, [pin, selectedUser, isLoading, handleSubmit])

  const isLocked = lockInfo?.locked && lockInfo.remainingSeconds > 0

  // スタッフ選択画面
  if (!selectedUser) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 pt-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">スタッフ選択</h1>
            <p className="mt-1 text-sm text-gray-500">
              名前をタップしてログインしてください
            </p>
          </div>

          {isLoadingUsers ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500">スタッフが登録されていません</p>
              <p className="mt-2 text-sm text-gray-400">
                設定画面からスタッフを追加してください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="flex h-24 items-center justify-center rounded-xl bg-white p-4 shadow-sm transition-all hover:bg-blue-50 hover:shadow-md active:bg-blue-100"
                >
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {user.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PIN入力画面
  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 pt-12">
      <div className="w-full max-w-sm">
        {/* 戻るボタン */}
        <button
          onClick={handleBack}
          className="mb-6 flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          スタッフ選択に戻る
        </button>

        {/* ユーザー情報 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
            {selectedUser.name.charAt(0)}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
          <p className="mt-1 text-sm text-gray-500">PINコードを入力してください</p>
        </div>

        {/* PINドット表示 */}
        <div className="mb-6 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full transition-all ${
                i < pin.length
                  ? 'scale-110 bg-blue-600'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ロック中の残り時間 */}
        {isLocked && (
          <div className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-center text-sm text-orange-600">
            ロック中: 残り {Math.ceil(lockInfo.remainingSeconds / 60)}分
            {lockInfo.remainingSeconds % 60}秒
          </div>
        )}

        {/* テンキー */}
        <NumericKeypad
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          disabled={isLoading || !!isLocked}
        />
      </div>
    </div>
  )
}
