import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 予約一覧取得（日付/範囲フィルター、JOIN付き）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // YYYY-MM-DD
    const startDate = searchParams.get('start_date') // YYYY-MM-DD
    const endDate = searchParams.get('end_date') // YYYY-MM-DD
    const unitNumber = searchParams.get('unit_number')

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:patients!patient_id(id, chart_number, name, name_kana),
        staff:users!staff_id(id, name)
      `)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true })

    // 日付フィルター（単日）
    if (date) {
      const dayStart = `${date}T00:00:00+09:00`
      const dayEnd = `${date}T23:59:59+09:00`
      query = query.gte('start_time', dayStart).lte('start_time', dayEnd)
    }

    // 日付範囲フィルター
    if (startDate && endDate) {
      const rangeStart = `${startDate}T00:00:00+09:00`
      const rangeEnd = `${endDate}T23:59:59+09:00`
      query = query.gte('start_time', rangeStart).lte('start_time', rangeEnd)
    }

    // ユニットフィルター
    if (unitNumber) {
      query = query.eq('unit_number', parseInt(unitNumber))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ appointments: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 新規予約作成
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const {
      patient_id,
      unit_number,
      staff_id,
      start_time,
      duration_minutes,
      appointment_type,
      memo,
    } = body

    // バリデーション
    if (!patient_id) return NextResponse.json({ error: '患者は必須です' }, { status: 400 })
    if (!unit_number) return NextResponse.json({ error: 'ユニットは必須です' }, { status: 400 })
    if (!staff_id) return NextResponse.json({ error: '担当スタッフは必須です' }, { status: 400 })
    if (!start_time) return NextResponse.json({ error: '開始時刻は必須です' }, { status: 400 })
    if (!duration_minutes) return NextResponse.json({ error: '所要時間は必須です' }, { status: 400 })
    if (!appointment_type) return NextResponse.json({ error: '予約種別は必須です' }, { status: 400 })
    if (duration_minutes % 5 !== 0) {
      return NextResponse.json({ error: '所要時間は5分単位で指定してください' }, { status: 400 })
    }

    // 重複チェック
    const overlapError = await checkOverlap(supabase, unit_number, start_time, duration_minutes)
    if (overlapError) {
      return NextResponse.json({ error: overlapError }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id,
        unit_number,
        staff_id,
        start_time,
        duration_minutes,
        appointment_type,
        memo: memo || null,
        status: '予約済み',
      })
      .select(`
        *,
        patient:patients!patient_id(id, chart_number, name, name_kana),
        staff:users!staff_id(id, name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ appointment: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 予約編集
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const {
      id,
      patient_id,
      unit_number,
      staff_id,
      start_time,
      duration_minutes,
      appointment_type,
      status,
      memo,
    } = body

    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })

    // ステータス更新のみの場合はバリデーション＋重複チェックをスキップ
    const isStatusOnly = status && !unit_number && !start_time && !duration_minutes

    if (!isStatusOnly) {
      if (duration_minutes && duration_minutes % 5 !== 0) {
        return NextResponse.json({ error: '所要時間は5分単位で指定してください' }, { status: 400 })
      }

      // 時間/ユニット変更時の重複チェック（自分自身を除外）
      if (unit_number && start_time && duration_minutes) {
        const overlapError = await checkOverlap(supabase, unit_number, start_time, duration_minutes, id)
        if (overlapError) {
          return NextResponse.json({ error: overlapError }, { status: 409 })
        }
      }
    }

    // 更新データの構築（undefinedなフィールドは除外）
    const updateData: Record<string, unknown> = {}
    if (patient_id !== undefined) updateData.patient_id = patient_id
    if (unit_number !== undefined) updateData.unit_number = unit_number
    if (staff_id !== undefined) updateData.staff_id = staff_id
    if (start_time !== undefined) updateData.start_time = start_time
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes
    if (appointment_type !== undefined) updateData.appointment_type = appointment_type
    if (status !== undefined) updateData.status = status
    if (memo !== undefined) updateData.memo = memo || null

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        patient:patients!patient_id(id, chart_number, name, name_kana),
        staff:users!staff_id(id, name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ appointment: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 論理削除
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })

    const { error } = await supabase
      .from('appointments')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 重複チェック: 同一ユニット・同一時間帯に既存予約がないか
async function checkOverlap(
  supabase: ReturnType<typeof createServerClient>,
  unitNumber: number,
  startTime: string,
  durationMinutes: number,
  excludeId?: string
): Promise<string | null> {
  const newStart = new Date(startTime)
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)

  // 同日・同ユニットの予約を取得
  const dayStart = new Date(newStart)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(newStart)
  dayEnd.setHours(23, 59, 59, 999)

  let query = supabase
    .from('appointments')
    .select('id, start_time, duration_minutes')
    .eq('unit_number', unitNumber)
    .eq('is_deleted', false)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: existing, error } = await query

  if (error) return 'スケジュールの確認中にエラーが発生しました'

  if (existing) {
    for (const appt of existing) {
      const existStart = new Date(appt.start_time)
      const existEnd = new Date(existStart.getTime() + appt.duration_minutes * 60 * 1000)

      // 重複判定: 新規の開始 < 既存の終了 AND 新規の終了 > 既存の開始
      if (newStart < existEnd && newEnd > existStart) {
        const timeStr = existStart.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        return `ユニット${unitNumber}の${timeStr}に既存の予約があります`
      }
    }
  }

  return null
}
