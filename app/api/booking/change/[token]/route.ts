import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { recordLog } from '@/lib/log/record-log'

// PUT: 予約変更（日時のみ。種別・所要時間はそのまま）（公開API）
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 5, windowMs: 60_000, name: 'booking-change' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const { token } = await props.params
    if (!token) {
      return NextResponse.json({ error: 'トークンは必須です' }, { status: 400 })
    }

    const body = await request.json()
    const { new_date, new_time } = body

    if (!new_date || !/^\d{4}-\d{2}-\d{2}$/.test(new_date)) {
      return NextResponse.json({ error: '日付は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
    }
    if (!new_time || !/^\d{2}:\d{2}$/.test(new_time)) {
      return NextResponse.json({ error: '時刻は HH:mm 形式で指定してください' }, { status: 400 })
    }

    const supabase = createServerClient()

    // 予約を取得
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id, start_time, duration_minutes, status, appointment_type, patient_id,
        unit_number, booking_token, booking_type_id, lab_order_id,
        patient:patients!patient_id(id, name, email, phone, preferred_notification, line_user_id),
        booking_type:booking_types!left(display_name, duration_minutes)
      `)
      .eq('booking_token', token)
      .eq('is_deleted', false)
      .single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    if (appointment.status !== 'scheduled' && appointment.status !== 'pending') {
      return NextResponse.json({ error: 'この予約は変更できません' }, { status: 400 })
    }

    // 期限チェック
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['web_cancel_deadline_time', 'clinic_phone', 'visible_units', 'unit_count'])

    let cancelDeadlineTime = '18:00'
    let clinicPhone = ''
    let visibleUnitsRaw = ''
    let unitCountRaw = ''
    if (settingsData) {
      for (const row of settingsData) {
        if (row.key === 'web_cancel_deadline_time') cancelDeadlineTime = row.value
        if (row.key === 'clinic_phone') clinicPhone = row.value
        if (row.key === 'visible_units') visibleUnitsRaw = row.value
        if (row.key === 'unit_count') unitCountRaw = row.value
      }
    }

    if (!isWithinDeadline(appointment.start_time, cancelDeadlineTime)) {
      return NextResponse.json(
        {
          error: `変更・キャンセルの受付期限（前日${cancelDeadlineTime}）を過ぎています。お電話にてご連絡ください。`,
          clinic_phone: clinicPhone,
        },
        { status: 403 }
      )
    }

    const durationMinutes = appointment.duration_minutes
    const newStartTime = `${new_date}T${new_time}:00+09:00`

    // 空きユニットを検索（変更元の予約は除外して検証）
    const allUnits = parseUnits(visibleUnitsRaw || unitCountRaw || '5')
    const newStart = new Date(newStartTime)
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)
    const dayStart = `${new_date}T00:00:00+09:00`
    const dayEnd = `${new_date}T23:59:59+09:00`

    const [appointmentsRes, blockedSlotsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, unit_number, start_time, duration_minutes')
        .eq('is_deleted', false)
        .not('status', 'in', '("cancelled","no_show")')
        .neq('id', appointment.id) // 変更元の予約を除外
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd),
      supabase
        .from('blocked_slots')
        .select('unit_number, start_time, end_time')
        .eq('is_deleted', false)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd),
    ])

    const existingAppointments = appointmentsRes.data || []
    const blockedSlots = blockedSlotsRes.data || []

    let assignedUnit: number | null = null
    for (const unit of allUnits) {
      let hasConflict = false

      for (const appt of existingAppointments) {
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

    // 変更前の情報を保持
    const oldStartTime = appointment.start_time
    const oldDateFormatted = formatDateJP(oldStartTime)
    const oldTime = formatTime(oldStartTime)

    // 予約を更新
    const updateData: Record<string, unknown> = {
      start_time: newStartTime,
      unit_number: assignedUnit,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointment.id)

    if (updateError) {
      return NextResponse.json({ error: '予約の変更に失敗しました' }, { status: 500 })
    }

    // lab_order_id がある場合は set_date も更新（失敗しても予約変更自体は成功）
    if (appointment.lab_order_id) {
      try {
        await supabase
          .from('lab_orders')
          .update({ set_date: new_date })
          .eq('id', appointment.lab_order_id)
      } catch {
        // ignore
      }
    }

    // 患者情報
    const patient = appointment.patient && !Array.isArray(appointment.patient)
      ? (appointment.patient as { id: string; name: string; email: string | null; phone: string | null; preferred_notification: string; line_user_id: string | null })
      : null
    const bookingType = appointment.booking_type && !Array.isArray(appointment.booking_type)
      ? (appointment.booking_type as { display_name: string; duration_minutes: number })
      : null

    const typeName = bookingType?.display_name || appointment.appointment_type
    const newDateFormatted = formatDateJP(newStartTime)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'
    const confirmUrl = `${appUrl}/booking/confirm/${token}`

    // ログ記録
    await recordLog({
      userName: 'Web患者',
      actionType: 'modify',
      targetType: 'appointment',
      targetId: appointment.id,
      summary: `Web患者が変更: ${patient?.name || ''} ${oldDateFormatted} ${oldTime} → ${newDateFormatted} ${new_time}`,
      details: {
        booking_token: token,
        patient_name: patient?.name,
        old_start_time: oldStartTime,
        new_start_time: newStartTime,
      },
    })

    // 通知送信
    if (patient) {
      try {
        const preferredNotification = (patient.preferred_notification || 'none') as 'line' | 'email' | 'none'

        const lineMessage = `🦷 金澤オーラルケアクリニック\n\nご予約を変更しました。\n\n変更前: ${oldDateFormatted} ${oldTime}〜\n変更後: ${newDateFormatted} ${new_time}〜\n📋 ${typeName}（${durationMinutes}分）\n\n▼ 予約の確認\n${confirmUrl}\n\n※変更・キャンセルは前日${cancelDeadlineTime}まで`

        const emailMessage = `${patient.name}様\n\nご予約を変更しましたのでお知らせいたします。\n\n■ 変更前\n日時: ${oldDateFormatted} ${oldTime}〜\n\n■ 変更後\n日時: ${newDateFormatted} ${new_time}〜\n内容: ${typeName}（${durationMinutes}分）\n\n■ 予約の確認\n${confirmUrl}\n\n金澤オーラルケアクリニック${clinicPhone ? `\n${clinicPhone}` : ''}`

        const message = preferredNotification === 'line' ? lineMessage : emailMessage

        await sendNotification(
          {
            patientId: patient.id,
            email: patient.email,
            lineUserId: patient.line_user_id,
            preferredNotification,
          },
          message,
          'booking_change',
          appointment.id,
          '【金澤オーラルケアクリニック】ご予約変更のお知らせ'
        )
      } catch (e) {
        console.error('変更通知送信失敗:', e)
      }
    }

    return NextResponse.json({
      success: true,
      old_start_time: oldStartTime,
      new_start_time: newStartTime,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isWithinDeadline(startTime: string, deadlineTime: string): boolean {
  const appointmentDate = new Date(startTime)
  const [hours, minutes] = deadlineTime.split(':').map(Number)
  const deadline = new Date(appointmentDate)
  deadline.setDate(deadline.getDate() - 1)
  deadline.setHours(hours, minutes, 0, 0)
  return new Date() < deadline
}

function parseUnits(raw: string): number[] {
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
  }
  return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 8).sort((a, b) => a - b)
}

function formatDateJP(startTime: string): string {
  const d = new Date(startTime)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${y}年${m}月${day}日（${days[d.getDay()]}）`
}

function formatTime(startTime: string): string {
  const d = new Date(startTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
