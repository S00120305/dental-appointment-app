'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function ClinicInfoPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clinicPhone, setClinicPhone] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/clinic-settings?keys=clinic_phone')
      const data = await res.json()
      if (res.ok && data.settings) {
        if (data.settings.clinic_phone) setClinicPhone(data.settings.clinic_phone)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/clinic-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'clinic_phone', value: clinicPhone }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      showToast('設定を保存しました', 'success')
    } catch {
      showToast('設定の保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">医院情報</h1>
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">医院情報</h1>

        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              医院電話番号
            </label>
            <p className="mb-2 text-sm text-gray-500">
              Web予約の確認通知に表示されます
            </p>
            <input
              type="tel"
              value={clinicPhone}
              onChange={e => setClinicPhone(e.target.value)}
              placeholder="076-XXX-XXXX"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-base sm:w-64"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
