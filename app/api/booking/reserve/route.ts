import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'

// POST: Web予約作成（公開API）
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 5, windowMs: 60_000, name: 'booking-reserve' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: '予約リクエストの上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const supabase = createServerClient()
    const body = await request.json()

    const {
      booking_type_id,
      date,
      time,
      patient_name,
      patient_name_kana,
      phone,
      email,
      memo,
    } = body

    // バリデーション
    if (!booking_type_id) {
      return NextResponse.json({ error: '予約種別は必須です' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日付は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
    }
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: '時刻は HH:mm 形式で指定してください' }, { status: 400 })
    }
    if (!patient_name?.trim()) {
      return NextResponse.json({ error: 'お名前は必須です' }, { status: 400 })
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: '電話番号は必須です' }, { status: 400 })
    }
    // 電話番号形式チェック（ハイフンあり/なし、日本の電話番号）
    const phoneClean = phone.replace(/[-\s]/g, '')
    if (!/^0\d{9,10}$/.test(phoneClean)) {
      return NextResponse.json({ error: '電話番号の形式が正しくありません' }, { status: 400 })
    }

    // 予約種別を取得（unit_type含む）
    const { data: bookingType, error: typeError } = await supabase
      .from('booking_types')
      .select('id, display_name, duration_minutes, confirmation_mode, is_web_bookable, is_active, unit_type')
      .eq('id', booking_type_id)
      .single()

    if (typeError || !bookingType) {
      return NextResponse.json({ error: '予約種別が見つかりません' }, { status: 404 })
    }
    if (!bookingType.is_web_bookable || !bookingType.is_active) {
      return NextResponse.json({ error: 'この予約種別はWeb予約できません' }, { status: 400 })
    }

    const durationMinutes = bookingType.duration_minutes
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
    const btUnitType: string = bookingType.unit_type || 'any'
    if (btUnitType !== 'any') {
      allUnits = allUnits.filter(u => unitTypesMap[String(u)] === btUnitType)
      if (allUnits.length === 0) {
        return NextResponse.json(
          { error: 'この予約種別に対応する診察室がありません。' },
          { status: 409 }
        )
      }
    }

    // 空きユニットを検索（二重予約防止）
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

    // 各ユニットの空き判定
    let assignedUnit: number | null = null

    for (const unit of allUnits) {
      let hasConflict = false

      // 既存予約との重複チェック
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

      // ブロック枠との重複チェック
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

    // 電話番号で既存患者を検索
    let patientId: string
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', phoneClean)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existingPatient) {
      patientId = existingPatient.id
    } else {
      // 新規患者作成
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          chart_number: `WEB-${Date.now()}`,
          name: patient_name.trim(),
          name_kana: patient_name_kana?.trim() || null,
          phone: phoneClean,
          email: email?.trim() || null,
          preferred_notification: email ? 'email' : 'none',
          memo: 'Web予約で自動作成',
        })
        .select('id')
        .single()

      if (patientError || !newPatient) {
        return NextResponse.json({ error: '患者情報の登録に失敗しました' }, { status: 500 })
      }
      patientId = newPatient.id
    }

    // デフォルトスタッフを取得
    const { data: defaultStaff } = await supabase
      .from('users')
      .select('id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(1)
      .single()

    if (!defaultStaff) {
      return NextResponse.json({ error: 'スタッフが登録されていません' }, { status: 500 })
    }

    // confirmation_mode に応じたステータス
    const autoConfirmed = bookingType.confirmation_mode === 'instant'
    const status = autoConfirmed ? 'scheduled' : 'pending'

    // 予約トークン生成
    const bookingToken = crypto.randomUUID()

    // 予約作成
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        unit_number: assignedUnit,
        staff_id: defaultStaff.id,
        start_time: startTime,
        duration_minutes: durationMinutes,
        appointment_type: bookingType.display_name,
        status,
        booking_type_id: booking_type_id,
        booking_source: 'web',
        booking_token: bookingToken,
        memo: memo?.trim() || null,
      })
      .select('id')
      .single()

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: '予約の作成に失敗しました' }, { status: 500 })
    }

    // 通知送信（非同期、失敗しても予約自体は成功）
    try {
      // 医院電話番号・患者情報を並列取得
      const [phoneRes, patientRes] = await Promise.all([
        supabase
          .from('clinic_settings')
          .select('value')
          .eq('key', 'clinic_phone')
          .maybeSingle(),
        supabase
          .from('patients')
          .select('preferred_notification, line_user_id, email')
          .eq('id', patientId)
          .single(),
      ])
      const clinicPhone = phoneRes.data?.value || ''
      const patientData = patientRes.data

      const dateFormatted = formatDateJP(date)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'
      const confirmUrl = `${appUrl}/booking/confirm/${bookingToken}`

      // 通知先の決定: 患者の preferred_notification を尊重、フォールバック
      const patientEmail = email?.trim() || patientData?.email || null
      const lineUserId = patientData?.line_user_id || null
      const preferredNotification = patientData?.preferred_notification || (patientEmail ? 'email' : 'none')

      if (autoConfirmed) {
        // 即時確定: 確認通知（テンプレートに従う）
        const emailMessage = `${patient_name.trim()}様\n\nご予約ありがとうございます。\n\n■ ご予約内容\n日時: ${dateFormatted} ${time}〜\n内容: ${bookingType.display_name}（${durationMinutes}分）\n\n■ 予約の確認・変更\n${confirmUrl}\n\n※ 変更・キャンセルは前日18:00まで${clinicPhone ? `\n※ お電話: ${clinicPhone}` : ''}\n\n金澤オーラルケアクリニック`

        const lineMessage = `🦷 金澤オーラルケアクリニック\n\nご予約ありがとうございます。\n\n📅 ${dateFormatted} ${time}〜\n📋 ${bookingType.display_name}（${durationMinutes}分）\n\n▼ 予約の確認\n${confirmUrl}\n\n※変更・キャンセルは前日18:00まで`

        // preferred に応じてメッセージを切り替え
        const message = preferredNotification === 'line' ? lineMessage : emailMessage

        await sendNotification(
          {
            patientId,
            email: patientEmail,
            lineUserId,
            preferredNotification: preferredNotification as 'line' | 'email' | 'none',
          },
          message,
          'booking_confirm',
          appointment.id,
          '【金澤オーラルケアクリニック】ご予約確認'
        )
      } else {
        // 承認制: リクエスト受付通知
        const message = `ご予約リクエストを受け付けました。\n\nご希望日時: ${dateFormatted} ${time}〜\n内容: ${bookingType.display_name}\n\n確認後、確定のご連絡をお送りします。\n（通常1営業日以内）`

        await sendNotification(
          {
            patientId,
            email: patientEmail,
            lineUserId,
            preferredNotification: preferredNotification as 'line' | 'email' | 'none',
          },
          message,
          'booking_request',
          appointment.id,
          '【金澤オーラルケアクリニック】ご予約リクエスト受付'
        )
      }
    } catch (e) {
      console.error('Web予約通知送信失敗:', e)
    }

    return NextResponse.json({
      success: true,
      token: bookingToken,
      auto_confirmed: autoConfirmed,
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
  return `${y}年${parseInt(m)}月${parseInt(d)}日（${days[date.getUTCDay()]}）`
}
