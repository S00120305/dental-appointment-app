import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 休診日一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const { data, error } = await supabase
      .from('clinic_holidays')
      .select('*')
      .order('holiday_type', { ascending: true })
      .order('specific_date', { ascending: true })
      .order('day_of_week', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // year フィルタ: weekly は全て返す、specific/national は year に一致するもの
    const filtered = (data || []).filter((h) => {
      if (h.holiday_type === 'weekly') return true
      if (h.specific_date) {
        return h.specific_date.startsWith(year)
      }
      return true
    })

    return NextResponse.json({ holidays: filtered })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 特定休診日を追加
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { specific_date, label } = body

    if (!specific_date) {
      return NextResponse.json({ error: '日付は必須です' }, { status: 400 })
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('clinic_holidays')
      .select('id')
      .eq('holiday_type', 'specific')
      .eq('specific_date', specific_date)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'この日付は既に登録されています' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('clinic_holidays')
      .insert({
        holiday_type: 'specific',
        specific_date,
        label: label || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ holiday: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 休診日を更新（is_active の切り替え等）
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { id, is_active, label } = body

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (is_active !== undefined) updateData.is_active = is_active
    if (label !== undefined) updateData.label = label

    const { error } = await supabase
      .from('clinic_holidays')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 特定休診日を削除（specific タイプのみ）
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }

    // specific タイプのみ物理削除可能
    const { data: target } = await supabase
      .from('clinic_holidays')
      .select('holiday_type')
      .eq('id', id)
      .single()

    if (!target) {
      return NextResponse.json({ error: '休診日が見つかりません' }, { status: 404 })
    }

    if (target.holiday_type === 'national') {
      return NextResponse.json({ error: '祝日は削除できません。is_active を切り替えてください' }, { status: 400 })
    }

    const { error } = await supabase
      .from('clinic_holidays')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
