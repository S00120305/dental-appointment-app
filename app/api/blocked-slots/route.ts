import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'

// GET: ブロック枠一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
      .from('blocked_slots')
      .select('id, unit_number, start_time, end_time, reason, is_recurring, created_by, is_deleted, created_at, updated_at')
      .eq('is_deleted', false)
      .order('start_time', { ascending: true })

    if (date) {
      const dayStart = `${date}T00:00:00+09:00`
      const dayEnd = `${date}T23:59:59+09:00`
      query = query.gte('start_time', dayStart).lte('start_time', dayEnd)
    }

    if (startDate && endDate) {
      const rangeStart = `${startDate}T00:00:00+09:00`
      const rangeEnd = `${endDate}T23:59:59+09:00`
      query = query.gte('start_time', rangeStart).lte('start_time', rangeEnd)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ blocked_slots: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: ブロック枠作成
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const { unit_number, start_time, end_time, reason } = body

    // バリデーション
    if (unit_number === undefined || unit_number === null) {
      return NextResponse.json({ error: '診察室は必須です' }, { status: 400 })
    }
    if (!start_time) {
      return NextResponse.json({ error: '開始時刻は必須です' }, { status: 400 })
    }
    if (!end_time) {
      return NextResponse.json({ error: '終了時刻は必須です' }, { status: 400 })
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)
    if (endDate <= startDate) {
      return NextResponse.json({ error: '終了時刻は開始時刻より後にしてください' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({
        unit_number,
        start_time,
        end_time,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    const time = new Date(start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
    const unitLabel = unit_number === 0 ? '全ユニット' : `診察室${unit_number}`
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'create',
      targetType: 'blocked_slot',
      targetId: data?.id,
      summary: `${user?.userName || '不明'}が ブロック枠を作成（${time} ${unitLabel}${reason ? ' ' + reason : ''}）`,
      details: { unit_number, start_time, end_time, reason },
    })

    return NextResponse.json({ blocked_slot: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: ブロック枠の論理削除
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
      .from('blocked_slots')
      .select('unit_number, start_time, reason')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('blocked_slots')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    const time = target?.start_time
      ? new Date(target.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
      : ''
    const unitLabel = target?.unit_number === 0 ? '全ユニット' : `診察室${target?.unit_number}`
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'delete',
      targetType: 'blocked_slot',
      targetId: id,
      summary: `${user?.userName || '不明'}が ブロック枠を削除（${time} ${unitLabel}）`,
      details: { unit_number: target?.unit_number, start_time: target?.start_time, reason: target?.reason },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
