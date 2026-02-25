'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { parseCsv, type CsvRow } from '@/lib/utils/csv'

type ImportResult = {
  inserted: number
  updated: number
  errorCount: number
  errors: { row: number; message: string }[]
}

export default function ImportPage() {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsed = parseCsv(text)
      setRows(parsed.rows)
      setParseErrors(parsed.errors)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleReset() {
    setRows([])
    setParseErrors([])
    setResult(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImport() {
    // バリデーションエラーがあるものを含めずに有効な行のみ送信
    const validRows = rows.filter((r) => r.chart_number && r.name)

    if (validRows.length === 0) {
      showToast('インポート可能なデータがありません', 'error')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'インポートに失敗しました', 'error')
        return
      }

      setResult(data)
      showToast(
        `インポート完了: 新規${data.inserted}件、更新${data.updated}件`,
        data.errorCount > 0 ? 'info' : 'success'
      )
    } catch {
      showToast('通信エラーが発生しました', 'error')
    } finally {
      setImporting(false)
    }
  }

  const errorRowNumbers = new Set(parseErrors.map((e) => e.row))

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-500 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">CSVインポート</h1>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          オプテック（レセコン）から出力した患者データCSVを取り込みます。
          カルテNoが既に存在する場合は情報が更新されます。
        </p>

        {/* CSVフォーマット説明 */}
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 text-sm font-medium text-emerald-800">CSVフォーマット</p>
          <code className="block whitespace-pre text-xs text-emerald-700">
            カルテNo,氏名,フリガナ,電話番号,メール{'\n'}
            1001,田中 太郎,タナカ タロウ,090-1234-5678,{'\n'}
            1002,佐藤 花子,サトウ ハナコ,,hanako@example.com
          </code>
        </div>

        {/* ファイル選択 */}
        {!result && (
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                CSVファイルを選択
              </Button>
              {fileName && (
                <span className="flex items-center text-sm text-gray-600">{fileName}</span>
              )}
            </div>
          </div>
        )}

        {/* パースエラー表示 */}
        {parseErrors.length > 0 && !result && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-medium text-red-800">
              バリデーションエラー（{parseErrors.length}件）
            </p>
            <ul className="space-y-1 text-sm text-red-700">
              {parseErrors.map((err, i) => (
                <li key={i}>
                  {err.row > 0 ? `${err.row}行目: ` : ''}
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* プレビューテーブル */}
        {rows.length > 0 && !result && (
          <>
            <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">カルテNo</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">氏名</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">フリガナ</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">電話番号</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">メール</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {rows.map((row, i) => {
                    const rowNum = i + 2 // header=1, data starts at 2
                    const hasError = errorRowNumbers.has(rowNum)
                    return (
                      <tr key={i} className={hasError ? 'bg-red-50' : ''}>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-400">{rowNum}</td>
                        <td className={`whitespace-nowrap px-3 py-2 ${hasError ? 'text-red-700 font-medium' : ''}`}>
                          {row.chart_number || <span className="text-red-500">（空）</span>}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 ${hasError ? 'text-red-700 font-medium' : ''}`}>
                          {row.name || <span className="text-red-500">（空）</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.name_kana}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.phone}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.email}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              全{rows.length}件
              {parseErrors.length > 0 && (
                <span className="text-red-600">（うちエラー{parseErrors.length}件はスキップされます）</span>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleReset}>
                やり直す
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'インポート中...' : 'インポート実行'}
              </Button>
            </div>
          </>
        )}

        {/* インポート結果 */}
        {result && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">インポート結果</h2>
            <div className="mb-4 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                <p className="text-sm text-green-600">新規登録</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-2xl font-bold text-emerald-700">{result.updated}</p>
                <p className="text-sm text-emerald-600">更新</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-700">{result.errorCount}</p>
                <p className="text-sm text-red-600">エラー</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-sm font-medium text-red-800">エラー詳細</p>
                <ul className="space-y-1 text-sm text-red-700">
                  {result.errors.map((err, i) => (
                    <li key={i}>
                      {err.row}行目: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleReset}>
                別のCSVをインポート
              </Button>
              <Link href="/patients">
                <Button>患者一覧を確認</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
