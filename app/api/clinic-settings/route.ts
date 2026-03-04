import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// GET: clinic_settings から指定キーの値を取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const keys = searchParams.get('keys')?.split(',').filter(Boolean)

    let query = supabase
      .from('clinic_settings')
      .select('key, value')

    if (keys && keys.length > 0) {
      query = query.in('key', keys)
    }

    const { data, error } = await query

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: clinic_settings を upsert（認証必須）
export async function PUT(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: '設定キーは必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('clinic_settings')
      .upsert(
        { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
        { onConflict: 'key' }
      )
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ setting: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
