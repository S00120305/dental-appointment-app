import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'

// GET: 全設定取得
export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('appointment_settings')
      .select('*')
      .order('key', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // key-value マップに変換
    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 設定更新（UPSERT）
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { key, value, updated_by } = body

    if (!key) {
      return NextResponse.json({ error: '設定キーは必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointment_settings')
      .upsert(
        {
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          updated_by: updated_by || null,
        },
        { onConflict: 'key' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'setting',
      targetId: key,
      summary: `${user?.userName || '不明'}が 設定「${key}」を更新`,
      details: { key, value },
    })

    return NextResponse.json({ setting: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
