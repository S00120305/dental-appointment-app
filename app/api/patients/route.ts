import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { formatPatientName } from '@/lib/utils/patient-name'

// GET: 患者一覧取得（検索対応）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('chart_number', { ascending: true })

    if (search) {
      query = query.or(
        `chart_number.ilike.%${search}%,last_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name_kana.ilike.%${search}%,first_name_kana.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ patients: data, total: count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 患者新規登録
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const { chart_number, last_name, first_name, last_name_kana, first_name_kana, phone, email, reminder_sms, reminder_email, preferred_notification, gender, date_of_birth, postal_code, address } = body

    // バリデーション
    if (!chart_number?.trim()) {
      return NextResponse.json({ error: 'カルテNoは必須です' }, { status: 400 })
    }
    if (!last_name?.trim()) {
      return NextResponse.json({ error: '姓は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('patients')
      .insert({
        chart_number: chart_number.trim(),
        last_name: last_name.trim(),
        first_name: first_name?.trim() || '',
        last_name_kana: last_name_kana?.trim() || null,
        first_name_kana: first_name_kana?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        reminder_sms: reminder_sms ?? false,
        reminder_email: reminder_email ?? false,
        preferred_notification: preferred_notification || 'line',
        gender: gender?.trim() || null,
        date_of_birth: date_of_birth || null,
        postal_code: postal_code?.trim() || null,
        address: address?.trim() || null,
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

    // ログ記録
    const user = await getSessionUser()
    const fullName = formatPatientName(last_name.trim(), first_name?.trim() || '')
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'create',
      targetType: 'patient',
      targetId: data?.id,
      summary: `${user?.userName || '不明'}が 患者 ${fullName}（${chart_number.trim()}）を登録`,
      details: { chart_number, last_name, first_name },
    })

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
      id, chart_number, last_name, first_name, last_name_kana, first_name_kana, phone, email,
      reminder_sms, reminder_email, preferred_notification, line_user_id,
      is_vip, caution_level, is_infection_alert,
      gender, date_of_birth, postal_code, address,
      birth_date, memo,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }
    if (!chart_number?.trim()) {
      return NextResponse.json({ error: 'カルテNoは必須です' }, { status: 400 })
    }
    if (!last_name?.trim()) {
      return NextResponse.json({ error: '姓は必須です' }, { status: 400 })
    }
    if (caution_level !== undefined && (caution_level < 0 || caution_level > 3)) {
      return NextResponse.json({ error: '注意レベルは0〜3で指定してください' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      chart_number: chart_number.trim(),
      last_name: last_name.trim(),
      first_name: first_name?.trim() || '',
      last_name_kana: last_name_kana?.trim() || null,
      first_name_kana: first_name_kana?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      reminder_sms: reminder_sms ?? false,
      reminder_email: reminder_email ?? false,
    }
    if (preferred_notification !== undefined) updateData.preferred_notification = preferred_notification
    if (line_user_id !== undefined) updateData.line_user_id = line_user_id
    if (is_vip !== undefined) updateData.is_vip = is_vip
    if (caution_level !== undefined) updateData.caution_level = caution_level
    if (is_infection_alert !== undefined) updateData.is_infection_alert = is_infection_alert
    if (gender !== undefined) updateData.gender = gender?.trim() || null
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth || null
    if (postal_code !== undefined) updateData.postal_code = postal_code?.trim() || null
    if (address !== undefined) updateData.address = address?.trim() || null
    if (birth_date !== undefined) updateData.birth_date = birth_date || null
    if (memo !== undefined) updateData.memo = memo ?? ''

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

    // ログ記録
    const user = await getSessionUser()
    const fullName = formatPatientName(last_name.trim(), first_name?.trim() || '')
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'patient',
      targetId: id,
      summary: `${user?.userName || '不明'}が 患者 ${fullName}（${chart_number.trim()}）を更新`,
      details: updateData,
    })

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

    // 削除前に情報取得（ログ用）
    const { data: target } = await supabase
      .from('patients')
      .select('last_name, first_name, chart_number')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('patients')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    const targetName = target ? formatPatientName(target.last_name, target.first_name) : '不明'
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'delete',
      targetType: 'patient',
      targetId: id,
      summary: `${user?.userName || '不明'}が 患者 ${targetName}（${target?.chart_number || ''}）を削除`,
      details: { last_name: target?.last_name, first_name: target?.first_name, chart_number: target?.chart_number },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
