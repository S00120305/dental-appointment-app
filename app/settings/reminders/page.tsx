'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const DEFAULT_SMS_TEMPLATE =
  '{patient_name}様\n明日 {date} {time} に{type}のご予約があります。\nおーるけあ歯科'

const DEFAULT_EMAIL_TEMPLATE =
  '{patient_name}様\n\nいつもお世話になっております。\n\n明日 {date} {time} に{type}のご予約が入っております。\nご来院をお待ちしております。\n\nおーるけあ歯科'

export default function RemindersSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testSending, setTestSending] = useState(false)

  const [reminderTime, setReminderTime] = useState('18:00')
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE)
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE)

  // テスト送信
  const [testPhone, setTestPhone] = useState('')
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        const s = data.settings
        if (s.reminder_time) setReminderTime(s.reminder_time)
        if (s.reminder_sms_template) setSmsTemplate(s.reminder_sms_template)
        if (s.reminder_email_template) setEmailTemplate(s.reminder_email_template)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function saveSetting(key: string, value: string) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, updated_by: 'staff' }),
    })
    return res.ok
  }

  async function handleSave() {
    setSaving(true)
    try {
      const results = await Promise.all([
        saveSetting('reminder_time', reminderTime),
        saveSetting('reminder_sms_template', smsTemplate),
        saveSetting('reminder_email_template', emailTemplate),
      ])

      if (results.every(Boolean)) {
        showToast('設定を保存しました', 'success')
      } else {
        showToast('一部の設定の保存に失敗しました', 'error')
      }
    } catch {
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    if (!testPhone && !testEmail) {
      showToast('テスト送信先を入力してください', 'error')
      return
    }

    setTestSending(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          test_phone: testPhone || undefined,
          test_email: testEmail || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'テスト送信に失敗しました', 'error')
        return
      }

      const results = data.results || {}
      const messages: string[] = []
      if (results.sms?.success) messages.push('SMS送信成功')
      if (results.sms && !results.sms.success) messages.push(`SMS失敗: ${results.sms.error}`)
      if (results.email?.success) messages.push('メール送信成功')
      if (results.email && !results.email.success) messages.push(`メール失敗: ${results.email.error}`)

      showToast(messages.join(' / ') || 'テスト送信完了', messages.some(m => m.includes('失敗')) ? 'error' : 'success')
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setTestSending(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <a
            href="/settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-2xl font-bold text-gray-900">リマインド設定</h1>
        </div>

        <div className="space-y-6">
          {/* 送信時刻 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">送信時刻</h2>
            <p className="mb-2 text-sm text-gray-500">
              予約前日の指定時刻にリマインド通知を送信します
            </p>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-base"
            />
          </div>

          {/* SMS テンプレート */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">SMS テンプレート</h2>
            <TemplateHelp />
            <textarea
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setSmsTemplate(DEFAULT_SMS_TEMPLATE)}
              className="mt-1 text-xs text-emerald-600 hover:underline"
            >
              デフォルトに戻す
            </button>
          </div>

          {/* メールテンプレート */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">メールテンプレート</h2>
            <TemplateHelp />
            <textarea
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setEmailTemplate(DEFAULT_EMAIL_TEMPLATE)}
              className="mt-1 text-xs text-emerald-600 hover:underline"
            >
              デフォルトに戻す
            </button>
          </div>

          {/* 保存ボタン */}
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? '保存中...' : '設定を保存'}
          </Button>

          {/* テスト送信 */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h2 className="mb-3 text-base font-bold text-orange-900">テスト送信</h2>
            <p className="mb-3 text-sm text-orange-700">
              テスト用のダミーデータで通知を送信します。先にテンプレートを保存してください。
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  SMS テスト送信先
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="090-1234-5678"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  メール テスト送信先
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleTestSend}
                disabled={testSending}
                className="w-full sm:w-auto"
              >
                {testSending ? '送信中...' : 'テスト送信'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function TemplateHelp() {
  return (
    <div className="mb-2 rounded-md bg-gray-50 p-2 text-xs text-gray-500">
      使用できる変数:
      <span className="ml-1 font-mono text-emerald-600">{'{patient_name}'}</span> 患者名 /
      <span className="ml-1 font-mono text-emerald-600">{'{date}'}</span> 予約日 /
      <span className="ml-1 font-mono text-emerald-600">{'{time}'}</span> 予約時刻 /
      <span className="ml-1 font-mono text-emerald-600">{'{type}'}</span> 予約種別
    </div>
  )
}
