import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 患者一覧取得（検索対応）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    let query = supabase
      .from('patients')
      .select('*')
      .eq('is_active', true)
      .order('chart_number', { ascending: true })

    if (search) {
      query = query.or(
        `chart_number.ilike.%${search}%,name.ilike.%${search}%,name_kana.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ patients: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 患者新規登録
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const { chart_number, name, name_kana, phone, email, reminder_sms, reminder_email } = body

    // バリデーション
    if (!chart_number?.trim()) {
      return NextResponse.json({ error: 'カルテNoは必須です' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('patients')
      .insert({
        chart_number: chart_number.trim(),
        name: name.trim(),
        name_kana: name_kana?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        reminder_sms: reminder_sms ?? false,
        reminder_email: reminder_email ?? false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'このカルテNoは既に登録されています' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ patient: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 患者情報更新
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const {
      id, chart_number, name, name_kana, phone, email,
      reminder_sms, reminder_email,
      is_vip, caution_level, is_infection_alert,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }
    if (!chart_number?.trim()) {
      return NextResponse.json({ error: 'カルテNoは必須です' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 })
    }
    if (caution_level !== undefined && (caution_level < 0 || caution_level > 3)) {
      return NextResponse.json({ error: '注意レベルは0〜3で指定してください' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      chart_number: chart_number.trim(),
      name: name.trim(),
      name_kana: name_kana?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      reminder_sms: reminder_sms ?? false,
      reminder_email: reminder_email ?? false,
    }
    if (is_vip !== undefined) updateData.is_vip = is_vip
    if (caution_level !== undefined) updateData.caution_level = caution_level
    if (is_infection_alert !== undefined) updateData.is_infection_alert = is_infection_alert

    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'このカルテNoは既に登録されています' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ patient: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 論理削除（is_active = false）
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }

    const { error } = await supabase
      .from('patients')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
