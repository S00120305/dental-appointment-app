import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { formatPatientName } from '@/lib/utils/patient-name'
import { requireAuth } from '@/lib/auth/require-auth'

/** visible_units 設定を取得してパースする */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getVisibleUnits(supabase: any): Promise<number[]> {
  const { data } = await supabase
    .from('appointment_settings')
    .select('key, value')
    .in('key', ['visible_units', 'unit_count'])

  const map: Record<string, string> = {}
  for (const row of (data || []) as { key: string; value: string }[]) {
    map[row.key] = row.value
  }

  const raw = map['visible_units'] || map['unit_count'] || '5'
  const trimmed = raw.trim()

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
  }

  return trimmed
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 8)
}

// tag_links をフラットな tags 配列に変換 + slide_from を整形するヘルパー
function transformAppointment(appointment: Record<string, unknown>) {
  const tagLinks = appointment.tag_links as { tag: { id: string; name: string; icon: string | null; color: string | null } | null }[] | null
  const tags = tagLinks
    ? tagLinks.map(link => link.tag).filter((t): t is NonNullable<typeof t> => t !== null)
    : []
  const { tag_links: _, ...rest } = appointment
  return { ...rest, tags }
}

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
    const status = searchParams.get('status') // e.g. 'pending'
    const bookingSource = searchParams.get('booking_source') // e.g. 'web'
    const countOnly = searchParams.get('count_only') === 'true'

    const selectQuery = `
      id, patient_id, unit_number, staff_id, start_time, duration_minutes,
      appointment_type, status, memo, lab_order_id, booking_type_id, slide_from_id,
      web_booking_status, booking_token, is_deleted, created_at, updated_at,
      patient:patients!patient_id(id, chart_number, last_name, first_name, last_name_kana, first_name_kana, phone, date_of_birth, is_vip, caution_level, is_infection_alert),
      staff:users!staff_id(id, name),
      lab_order:lab_orders!left(id, status, item_type, tooth_info, due_date, set_date, lab:labs!left(id, name)),
      booking_type:booking_types!left(id, display_name, internal_name, color, category),
      tag_links:appointment_tag_links(tag:appointment_tags(id, name, icon, color)),
      slide_from:appointments!slide_from_id(id, unit_number, appointment_type, start_time, duration_minutes, staff:users!staff_id(id, name))
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
        console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
      }
      return NextResponse.json({ appointment: transformAppointment(data as Record<string, unknown>) })
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

    // ステータスフィルター
    if (status) {
      query = query.eq('status', status)
    }

    // 予約ソースフィルター
    if (bookingSource) {
      query = query.eq('booking_source', bookingSource)
    }

    // count_only: バッジ件数用（軽量）
    if (countOnly) {
      const { count, error: countError } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', status || 'pending')
        .eq('booking_source', bookingSource || 'web')

      if (countError) {
        console.error('DB error:', countError.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
      }
      return NextResponse.json({ count: count || 0 })
    }

    const { data, error } = await query

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const appointments = (data || []).map(d => transformAppointment(d as Record<string, unknown>))
    return NextResponse.json({ appointments })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST/PUT 用の SELECT クエリ（lab_order + booking_type + slide_from JOIN 付き）
const selectQueryPost = `
  id, patient_id, unit_number, staff_id, start_time, duration_minutes,
  appointment_type, status, memo, lab_order_id, booking_type_id, slide_from_id,
  web_booking_status, booking_token, is_deleted, created_at, updated_at,
  patient:patients!patient_id(id, chart_number, last_name, first_name, last_name_kana, first_name_kana, is_vip, caution_level, is_infection_alert),
  staff:users!staff_id(id, name),
  lab_order:lab_orders!left(id, status, item_type, tooth_info, due_date, set_date, lab:labs!left(id, name)),
  booking_type:booking_types!left(id, display_name, internal_name, color, category),
  tag_links:appointment_tag_links(tag:appointment_tags(id, name, icon, color)),
  slide_from:appointments!slide_from_id(id, unit_number, appointment_type, start_time, duration_minutes, staff:users!staff_id(id, name))
`

// POST: 新規予約作成
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

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
      booking_type_id,
      slide_from_id,
      tag_ids,
    } = body

    // バリデーション
    if (!patient_id) return NextResponse.json({ error: '患者は必須です' }, { status: 400 })
    if (!unit_number) return NextResponse.json({ error: '診察室は必須です' }, { status: 400 })
    if (!staff_id) return NextResponse.json({ error: '担当スタッフは必須です' }, { status: 400 })
    if (!start_time) return NextResponse.json({ error: '開始時刻は必須です' }, { status: 400 })
    if (!duration_minutes) return NextResponse.json({ error: '所要時間は必須です' }, { status: 400 })
    if (!appointment_type) return NextResponse.json({ error: '予約種別は必須です' }, { status: 400 })
    if (duration_minutes % 10 !== 0) {
      return NextResponse.json({ error: '所要時間は10分単位で指定してください' }, { status: 400 })
    }

    // 表示中の診察室のみ予約可能
    const visibleUnits = await getVisibleUnits(supabase)
    if (!visibleUnits.includes(unit_number)) {
      return NextResponse.json({ error: `診察室${unit_number}は現在使用されていません` }, { status: 400 })
    }

    // 重複チェック
    const overlapError = await checkOverlap(supabase, unit_number, start_time, duration_minutes)
    if (overlapError) {
      return NextResponse.json({ error: overlapError }, { status: 409 })
    }

    // ブロック枠チェック
    const blockError = await checkBlockedSlotOverlap(supabase, unit_number, start_time, duration_minutes)
    if (blockError) {
      return NextResponse.json({ error: blockError }, { status: 409 })
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
        booking_type_id: booking_type_id || null,
        slide_from_id: slide_from_id || null,
        status: 'scheduled',
      })
      .select(selectQueryPost)
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // タグ紐付け
    if (tag_ids?.length && data?.id) {
      const { error: tagError } = await supabase
        .from('appointment_tag_links')
        .insert(tag_ids.map((tag_id: string) => ({ appointment_id: data.id, tag_id })))
      if (tagError) console.error('Tag insertion failed:', tagError.message)
    }

    // タグ付きで再取得
    let responseData = data
    if (tag_ids?.length && data?.id) {
      const { data: refreshed } = await supabase
        .from('appointments')
        .select(selectQueryPost)
        .eq('id', data.id)
        .single()
      if (refreshed) responseData = refreshed
    }

    // ログ記録
    const user = await getSessionUser()
    const patientObj = responseData?.patient && !Array.isArray(responseData.patient) ? (responseData.patient as { last_name: string; first_name: string }) : null
    const patientName = patientObj ? formatPatientName(patientObj.last_name, patientObj.first_name) : '不明'
    const time = new Date(start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'create',
      targetType: 'appointment',
      targetId: responseData?.id,
      summary: `${user?.userName || '不明'}が ${patientName} の予約を作成（${time} 診察室${unit_number}）`,
      details: { patient_id, unit_number, staff_id, start_time, duration_minutes, appointment_type },
    })

    return NextResponse.json({ appointment: transformAppointment(responseData as Record<string, unknown>) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 予約編集
export async function PUT(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

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
      booking_type_id,
      slide_from_id,
      current_updated_at,
      tag_ids,
    } = body

    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })

    // 更新前の予約を取得（競合検出 + start_time 変更検知 + ログ用）
    const { data: existing } = await supabase
      .from('appointments')
      .select('updated_at, start_time, lab_order_id, status, unit_number, patient:patients!patient_id(last_name, first_name)')
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
      if (duration_minutes && duration_minutes % 10 !== 0) {
        return NextResponse.json({ error: '所要時間は10分単位で指定してください' }, { status: 400 })
      }

      // 表示中の診察室のみ予約可能
      if (unit_number) {
        const visibleUnits = await getVisibleUnits(supabase)
        if (!visibleUnits.includes(unit_number)) {
          return NextResponse.json({ error: `診察室${unit_number}は現在使用されていません` }, { status: 400 })
        }
      }

      // 時間/ユニット変更時の重複チェック（自分自身を除外）
      if (unit_number && start_time && duration_minutes) {
        const overlapError = await checkOverlap(supabase, unit_number, start_time, duration_minutes, id)
        if (overlapError) {
          return NextResponse.json({ error: overlapError }, { status: 409 })
        }

        // ブロック枠チェック
        const blockError = await checkBlockedSlotOverlap(supabase, unit_number, start_time, duration_minutes)
        if (blockError) {
          return NextResponse.json({ error: blockError }, { status: 409 })
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
    if (booking_type_id !== undefined) updateData.booking_type_id = booking_type_id || null
    if (slide_from_id !== undefined) updateData.slide_from_id = slide_from_id || null

    // キャンセル/無断キャンセル時、この予約をスライド元として参照している予約のslide_from_idをクリア
    if (status === 'cancelled' || status === 'no_show') {
      const { error: slideError } = await supabase
        .from('appointments')
        .update({ slide_from_id: null })
        .eq('slide_from_id', id)
      if (slideError) console.error('Slide ref cleanup failed:', slideError.message)
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select(selectQueryPost)
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // タグ同期（tag_ids が渡された場合のみ、全置換）
    if (tag_ids !== undefined) {
      const { error: delErr } = await supabase.from('appointment_tag_links').delete().eq('appointment_id', id)
      if (delErr) console.error('Tag delete failed:', delErr.message)
      if (tag_ids.length) {
        const { error: insErr } = await supabase
          .from('appointment_tag_links')
          .insert(tag_ids.map((tag_id: string) => ({ appointment_id: id, tag_id })))
        if (insErr) console.error('Tag insert failed:', insErr.message)
      }
    }

    // タグ更新後は再取得してレスポンスに反映
    let responseData = data
    if (tag_ids !== undefined) {
      const { data: refreshed } = await supabase
        .from('appointments')
        .select(selectQueryPost)
        .eq('id', id)
        .single()
      if (refreshed) responseData = refreshed
    }

    // ログ記録
    const user = await getSessionUser()
    const existingPatientObj = existing?.patient && !Array.isArray(existing.patient) ? (existing.patient as { last_name: string; first_name: string }) : null
    const responsePatientObj = responseData?.patient && !Array.isArray(responseData.patient) ? (responseData.patient as { last_name: string; first_name: string }) : null
    const patientName = responsePatientObj ? formatPatientName(responsePatientObj.last_name, responsePatientObj.first_name) : existingPatientObj ? formatPatientName(existingPatientObj.last_name, existingPatientObj.first_name) : '不明'
    if (isStatusOnly) {
      await recordLog({
        userId: user?.userId,
        userName: user?.userName,
        actionType: 'status_change',
        targetType: 'appointment',
        targetId: id,
        summary: `${user?.userName || '不明'}が ${patientName} のステータスを ${status} に変更`,
        details: { previous_status: existing?.status, new_status: status },
      })
    } else {
      await recordLog({
        userId: user?.userId,
        userName: user?.userName,
        actionType: 'update',
        targetType: 'appointment',
        targetId: id,
        summary: `${user?.userName || '不明'}が ${patientName} の予約を更新`,
        details: updateData,
      })
    }

    // NOTE: lab_orders への書き込みは禁止（App A が管理）
    // set_date の同期が必要な場合は App A 側で対応する

    return NextResponse.json({ appointment: transformAppointment(responseData as Record<string, unknown>) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 論理削除
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })

    // 削除前に情報取得（ログ用）
    const { data: target } = await supabase
      .from('appointments')
      .select('unit_number, start_time, patient:patients!patient_id(last_name, first_name)')
      .eq('id', id)
      .single()

    // この予約をスライド元として参照している予約の slide_from_id をクリア
    await supabase
      .from('appointments')
      .update({ slide_from_id: null })
      .eq('slide_from_id', id)

    const { error } = await supabase
      .from('appointments')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    const targetPatientObj = target?.patient && !Array.isArray(target.patient) ? (target.patient as { last_name: string; first_name: string }) : null
    const patientName = targetPatientObj ? formatPatientName(targetPatientObj.last_name, targetPatientObj.first_name) : '不明'
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'delete',
      targetType: 'appointment',
      targetId: id,
      summary: `${user?.userName || '不明'}が ${patientName} の予約を削除`,
      details: { unit_number: target?.unit_number, start_time: target?.start_time },
    })

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
        const timeStr = existStart.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
        return `診察室${unitNumber}の${timeStr}に既存の予約があります`
      }
    }
  }

  return null
}

// ブロック枠との重複チェック
async function checkBlockedSlotOverlap(
  supabase: ReturnType<typeof createServerClient>,
  unitNumber: number,
  startTime: string,
  durationMinutes: number
): Promise<string | null> {
  const newStart = new Date(startTime)
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)

  const dayStart = new Date(newStart)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(newStart)
  dayEnd.setHours(23, 59, 59, 999)

  // unit_number が一致 OR unit_number = 0（全ユニット）のブロック枠を取得
  const { data: blocks, error } = await supabase
    .from('blocked_slots')
    .select('id, start_time, end_time, reason, unit_number')
    .eq('is_deleted', false)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .or(`unit_number.eq.${unitNumber},unit_number.eq.0`)

  if (error) return 'ブロック枠の確認中にエラーが発生しました'

  if (blocks) {
    for (const block of blocks) {
      const blockStart = new Date(block.start_time)
      const blockEnd = new Date(block.end_time)

      if (newStart < blockEnd && newEnd > blockStart) {
        const reason = block.reason ? `（理由: ${block.reason}）` : ''
        return `この時間帯はブロックされています${reason}`
      }
    }
  }

  return null
}
