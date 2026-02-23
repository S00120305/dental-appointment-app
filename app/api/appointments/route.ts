import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 予約一覧取得（日付/範囲フィルター、JOIN付き）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') // 単一予約取得
    const patientId = searchParams.get('patient_id') // 患者ID（UUID）
    const date = searchParams.get('date') // YYYY-MM-DD
    const startDate = searchParams.get('start_date') // YYYY-MM-DD
    const endDate = searchParams.get('end_date') // YYYY-MM-DD
    const unitNumber = searchParams.get('unit_number')

    const selectQuery = `
      *,
      patient:patients!patient_id(id, chart_number, name, name_kana),
      staff:users!staff_id(id, name),
      lab_order:lab_orders!left(id, status, item_type, tooth_info, due_date, set_date, lab:labs!left(id, name))
    `

    // 単一予約取得（Realtime INSERT 後の詳細取得用）
    if (id) {
      const { data, error } = await supabase
        .from('appointments')
        .select(selectQuery)
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ appointment: data })
    }

    let query = supabase
      .from('appointments')
      .select(selectQuery)
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

    // 患者フィルター
    if (patientId) {
      query = query.eq('patient_id', patientId)
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

// POST/PUT 用の SELECT クエリ（lab_order JOIN 付き）
const selectQueryPost = `
  *,
  patient:patients!patient_id(id, chart_number, name, name_kana),
  staff:users!staff_id(id, name),
  lab_order:lab_orders!left(id, status, item_type, tooth_info, due_date, set_date, lab:labs!left(id, name))
`

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
      lab_order_id,
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
        lab_order_id: lab_order_id || null,
        status: '予約済み',
      })
      .select(selectQueryPost)
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
      lab_order_id,
      current_updated_at,
    } = body

    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })

    // 更新前の予約を取得（競合検出 + start_time 変更検知に使用）
    const { data: existing } = await supabase
      .from('appointments')
      .select('updated_at, start_time, lab_order_id')
      .eq('id', id)
      .single()

    // 競合検出: current_updated_at が指定されている場合、DB の updated_at と比較
    if (current_updated_at && existing) {
      if (existing.updated_at !== current_updated_at) {
        return NextResponse.json(
          { error: '他の端末で更新されました。最新データを再取得します。', conflict: true },
          { status: 409 }
        )
      }
    }

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
    if (lab_order_id !== undefined) updateData.lab_order_id = lab_order_id || null

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select(selectQueryPost)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 予約日変更時: 紐付く lab_orders.set_date を同期更新
    // start_time が実際に変わった場合のみ（ステータス変更等では更新しない）
    if (start_time && existing && data) {
      const oldDate = existing.start_time ? new Date(existing.start_time).toISOString().split('T')[0] : null
      const newDate = new Date(start_time).toISOString().split('T')[0]
      const startTimeChanged = oldDate !== newDate

      if (startTimeChanged) {
        const effectiveLabOrderId = lab_order_id !== undefined ? (lab_order_id || null) : existing.lab_order_id
        if (effectiveLabOrderId) {
          try {
            await supabase
              .from('lab_orders')
              .update({ set_date: newDate, updated_at: new Date().toISOString() })
              .eq('id', effectiveLabOrderId)
          } catch {
            // set_date 更新失敗でも予約変更自体は成功させる
            console.error('Failed to update lab_order set_date')
          }
        }
      }
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
