import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    let query = supabase
      .from('staff_holidays')
      .select('id, user_id, holiday_date, holiday_type, label, created_at')
      .eq('is_deleted', false)
      .order('holiday_date', { ascending: true })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (year && month) {
      const m = String(month).padStart(2, '0')
      query = query.gte('holiday_date', `${year}-${m}-01`)
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      query = query.lte('holiday_date', `${year}-${m}-${String(lastDay).padStart(2, '0')}`)
    } else if (year) {
      query = query.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`)
    }

    const { data, error } = await query

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ staff_holidays: data || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { user_id, holiday_date, holiday_type, label } = body

    if (!user_id || !holiday_date || !holiday_type) {
      return NextResponse.json({ error: 'user_id, holiday_date, holiday_type は必須です' }, { status: 400 })
    }

    const validTypes = ['paid_leave', 'day_off', 'half_day_am', 'half_day_pm', 'other']
    if (!validTypes.includes(holiday_type)) {
      return NextResponse.json({ error: '無効な holiday_type です' }, { status: 400 })
    }

    // UPSERT: 同じスタッフ+日付は上書き
    // まず既存レコードを確認
    const { data: existing } = await supabase
      .from('staff_holidays')
      .select('id')
      .eq('user_id', user_id)
      .eq('holiday_date', holiday_date)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('staff_holidays')
        .update({ holiday_type, label: label || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
      }
      return NextResponse.json({ staff_holiday: data })
    }

    // 論理削除されたものも復活
    const { data: deleted } = await supabase
      .from('staff_holidays')
      .select('id')
      .eq('user_id', user_id)
      .eq('holiday_date', holiday_date)
      .eq('is_deleted', true)
      .maybeSingle()

    if (deleted) {
      const { data, error } = await supabase
        .from('staff_holidays')
        .update({
          holiday_type,
          label: label || null,
          is_deleted: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deleted.id)
        .select()
        .single()

      if (error) {
        console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
      }
      return NextResponse.json({ staff_holiday: data })
    }

    // 新規作成
    const { data, error } = await supabase
      .from('staff_holidays')
      .insert({ user_id, holiday_date, holiday_type, label: label || null })
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ staff_holiday: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id は必須です' }, { status: 400 })
    }

    const { error } = await supabase
      .from('staff_holidays')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
