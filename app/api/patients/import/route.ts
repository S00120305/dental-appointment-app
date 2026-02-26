import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'

type ImportRow = {
  chart_number: string
  name: string
  name_kana?: string
  phone?: string
  email?: string
  gender?: string
  date_of_birth?: string
  postal_code?: string
  address?: string
}

// POST: CSV一括インポート（UPSERT）
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const rows: ImportRow[] = body.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'インポートデータがありません' }, { status: 400 })
    }

    let inserted = 0
    let updated = 0
    let errors: { row: number; message: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      if (!row.chart_number?.trim()) {
        errors.push({ row: i + 1, message: 'カルテNoは必須です' })
        continue
      }
      if (!row.name?.trim()) {
        errors.push({ row: i + 1, message: '氏名は必須です' })
        continue
      }

      // 既存レコードをチェック
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('chart_number', row.chart_number.trim())
        .single()

      if (existing) {
        // 更新（UPSERT: 既存レコードを更新）
        const updateData: Record<string, unknown> = {
            name: row.name.trim(),
            name_kana: row.name_kana?.trim() || null,
            phone: row.phone?.trim() || null,
            email: row.email?.trim() || null,
            is_active: true,
          }
        if (row.gender) updateData.gender = row.gender.trim()
        if (row.date_of_birth) updateData.date_of_birth = row.date_of_birth.trim()
        if (row.postal_code) updateData.postal_code = row.postal_code.trim()
        if (row.address) updateData.address = row.address.trim()

        const { error } = await supabase
          .from('patients')
          .update(updateData)
          .eq('id', existing.id)

        if (error) {
          errors.push({ row: i + 1, message: error.message })
        } else {
          updated++
        }
      } else {
        // 新規登録
        const insertData: Record<string, unknown> = {
          chart_number: row.chart_number.trim(),
          name: row.name.trim(),
          name_kana: row.name_kana?.trim() || null,
          phone: row.phone?.trim() || null,
          email: row.email?.trim() || null,
        }
        if (row.gender) insertData.gender = row.gender.trim()
        if (row.date_of_birth) insertData.date_of_birth = row.date_of_birth.trim()
        if (row.postal_code) insertData.postal_code = row.postal_code.trim()
        if (row.address) insertData.address = row.address.trim()

        const { error } = await supabase.from('patients').insert(insertData)

        if (error) {
          errors.push({ row: i + 1, message: error.message })
        } else {
          inserted++
        }
      }
    }

    // ログ記録
    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'import',
      targetType: 'patient',
      targetId: null,
      summary: `${user?.userName || '不明'}が 患者CSVインポートを実行（新規${inserted}件, 更新${updated}件, エラー${errors.length}件）`,
      details: { total: rows.length, inserted, updated, errorCount: errors.length },
    })

    return NextResponse.json({
      inserted,
      updated,
      errorCount: errors.length,
      errors: errors.slice(0, 50), // 最大50件のエラーを返す
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
