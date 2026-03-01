import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { toPatientDisplayName } from '@/lib/utils/patient-display'

// POST: トークン予約確定（公開API）
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 5, windowMs: 60_000, name: 'booking-token-reserve' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: '予約リクエストの上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const { token } = await props.params
    const supabase = createServerClient()
    const body = await request.json()

    const { date, time } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日付は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
    }
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: '時刻は HH:mm 形式で指定してください' }, { status: 400 })
    }

    // トークン取得 + バリデーション
    const { data: tokenData, error: tokenError } = await supabase
      .from('booking_tokens')
      .select(`
        id, token, patient_id, booking_type_id, duration_minutes,
        staff_id, unit_number, status, expires_at,
        patient:patients!patient_id(id, name, email, line_user_id, preferred_notification),
        booking_type:booking_types!booking_type_id(id, display_name, duration_minutes, category, is_web_bookable)
      `)
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'このご案内番号は無効です' }, { status: 404 })
    }

    if (tokenData.status === 'used') {
      return NextResponse.json({ error: 'このご案内は使用済みです' }, { status: 410 })
    }
    if (tokenData.status === 'expired' || new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'このご案内の有効期限が切れています' }, { status: 410 })
    }

    const durationMinutes = tokenData.duration_minutes
    const startTime = `${date}T${time}:00+09:00`

    // 設定取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['visible_units', 'unit_count', 'unit_types'])

    let visibleUnitsRaw = ''
    let unitCountRaw = ''
    let unitTypesMap: Record<string, string> = {}
    if (settingsData) {
      for (const row of settingsData) {
        if (row.key === 'visible_units') visibleUnitsRaw = row.value
        if (row.key === 'unit_count') unitCountRaw = row.value
        if (row.key === 'unit_types') {
          try { unitTypesMap = JSON.parse(row.value) } catch { /* ignore */ }
        }
      }
    }
    let allUnits = parseUnits(visibleUnitsRaw || unitCountRaw || '5')

    // Phase 3: unit_type フィルタ
    const btForType = tokenData.booking_type && !Array.isArray(tokenData.booking_type)
      ? (tokenData.booking_type as { id: string; display_name: string; duration_minutes: number; category: string | null; is_web_bookable: boolean })
      : null
    if (btForType) {
      const { data: btTypeData } = await supabase
        .from('booking_types')
        .select('unit_type')
        .eq('id', btForType.id)
        .single()
      const btUnitType = btTypeData?.unit_type || 'any'
      if (btUnitType !== 'any') {
        allUnits = allUnits.filter(u => unitTypesMap[String(u)] === btUnitType)
        if (allUnits.length === 0) {
          return NextResponse.json(
            { error: 'この予約種別に対応する診察室がありません。' },
            { status: 409 }
          )
        }
      }
    }

    // 空きユニット検索
    const newStart = new Date(startTime)
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)
    const dayStart = `${date}T00:00:00+09:00`
    const dayEnd = `${date}T23:59:59+09:00`

    const [appointmentsRes, blockedSlotsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('unit_number, start_time, duration_minutes')
        .eq('is_deleted', false)
        .not('status', 'in', '("cancelled","no_show")')
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd),
      supabase
        .from('blocked_slots')
        .select('unit_number, start_time, end_time')
        .eq('is_deleted', false)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd),
    ])

    const appointments = appointmentsRes.data || []
    const blockedSlots = blockedSlotsRes.data || []

    // ユニット割当: トークンに指定がある場合はそのユニットのみ
    const candidateUnits = tokenData.unit_number ? [tokenData.unit_number] : allUnits
    let assignedUnit: number | null = null

    for (const unit of candidateUnits) {
      let hasConflict = false

      for (const appt of appointments) {
        if (appt.unit_number !== unit) continue
        const existStart = new Date(appt.start_time)
        const existEnd = new Date(existStart.getTime() + appt.duration_minutes * 60 * 1000)
        if (newStart < existEnd && newEnd > existStart) {
          hasConflict = true
          break
        }
      }

      if (hasConflict) continue

      for (const block of blockedSlots) {
        if (block.unit_number !== 0 && block.unit_number !== unit) continue
        const blockStart = new Date(block.start_time)
        const blockEnd = new Date(block.end_time)
        if (newStart < blockEnd && newEnd > blockStart) {
          hasConflict = true
          break
        }
      }

      if (!hasConflict) {
        assignedUnit = unit
        break
      }
    }

    if (!assignedUnit) {
      return NextResponse.json(
        { error: 'この時間帯は空きがありません。別の時間帯をお選びください。' },
        { status: 409 }
      )
    }

    // デフォルトスタッフ（トークンに指定がある場合はそれを使用）
    let staffId = tokenData.staff_id
    if (!staffId) {
      const { data: defaultStaff } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(1)
        .single()
      staffId = defaultStaff?.id
    }

    if (!staffId) {
      return NextResponse.json({ error: 'スタッフが登録されていません' }, { status: 500 })
    }

    // 予約作成（即時確定）
    const bookingToken = crypto.randomUUID()
    const bookingType = tokenData.booking_type && !Array.isArray(tokenData.booking_type)
      ? (tokenData.booking_type as { id: string; display_name: string; duration_minutes: number; category: string | null; is_web_bookable: boolean })
      : null

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        patient_id: tokenData.patient_id,
        unit_number: assignedUnit,
        staff_id: staffId,
        start_time: startTime,
        duration_minutes: durationMinutes,
        appointment_type: bookingType?.display_name || '',
        status: 'scheduled',
        booking_type_id: tokenData.booking_type_id,
        booking_source: 'token',
        booking_token: bookingToken,
        memo: null,
      })
      .select('id')
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: '予約の作成に失敗しました' }, { status: 500 })
    }

    // トークンを使用済みに更新
    await supabase
      .from('booking_tokens')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        appointment_id: appointment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id)

    // 確認通知送信
    try {
      const patient = tokenData.patient && !Array.isArray(tokenData.patient)
        ? (tokenData.patient as { id: string; name: string; email: string | null; line_user_id: string | null; preferred_notification: string })
        : null

      if (patient) {
        const { data: phoneRow } = await supabase
          .from('clinic_settings')
          .select('value')
          .eq('key', 'clinic_phone')
          .maybeSingle()
        const clinicPhone = phoneRow?.value || ''

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'
        const confirmUrl = `${appUrl}/booking/confirm/${bookingToken}`
        const patientDisplayName = bookingType
          ? toPatientDisplayName(bookingType.display_name, bookingType.category, bookingType.is_web_bookable)
          : '診療'
        const dateFormatted = formatDateJP(date)

        let message: string
        if (patient.preferred_notification === 'line' && patient.line_user_id) {
          message = `🦷 金澤オーラルケアクリニック\n\nご予約ありがとうございます。\n\n📅 ${dateFormatted} ${time}〜\n📋 ${patientDisplayName}（${durationMinutes}分）\n\n▼ 予約の確認\n${confirmUrl}\n\n※変更・キャンセルは前日18:00まで`
        } else {
          message = `${patient.name}様\n\nご予約ありがとうございます。\n\n■ ご予約内容\n日時: ${dateFormatted} ${time}〜\n内容: ${patientDisplayName}（${durationMinutes}分）\n\n■ 予約の確認・変更\n${confirmUrl}\n\n※ 変更・キャンセルは前日18:00まで${clinicPhone ? `\n※ お電話: ${clinicPhone}` : ''}\n\n金澤オーラルケアクリニック\n〒921-8148 石川県金沢市額新保2-272番地`
        }

        await sendNotification(
          {
            patientId: patient.id,
            email: patient.email,
            lineUserId: patient.line_user_id,
            preferredNotification: (patient.preferred_notification || 'none') as 'line' | 'email' | 'none',
          },
          message,
          'booking_confirm',
          appointment.id,
          '【金澤オーラルケアクリニック】ご予約確認'
        )
      }
    } catch (e) {
      console.error('トークン予約確認通知失敗:', e)
    }

    return NextResponse.json({
      success: true,
      booking_token: bookingToken,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseUnits(raw: string): number[] {
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
  }
  return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 8).sort((a, b) => a - b)
}

function formatDateJP(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(`${dateStr}T00:00:00+09:00`)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日（${days[date.getUTCDay()]}）`
}
