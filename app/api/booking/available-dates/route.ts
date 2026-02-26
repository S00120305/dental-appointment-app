import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

type OccupiedInterval = { start: number; end: number; type: 'appointment' | 'lunch' | 'blocked' }

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

// GET: 指定月の予約可能日一覧（公開API）
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(ip, { limit: 60, windowMs: 60_000, name: 'booking-read' })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'リクエスト回数の上限に達しました。しばらくお待ちください。' },
        { status: 429 }
      )
    }

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const typeId = searchParams.get('type_id')
    const month = searchParams.get('month') // YYYY-MM

    if (!typeId || !month) {
      return NextResponse.json({ error: 'type_id と month は必須です' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month の形式は YYYY-MM です' }, { status: 400 })
    }

    // source=token の場合はトークン経由（is_web_bookable チェックをスキップ）
    const source = searchParams.get('source')

    // 予約種別を取得（unit_type含む）
    const { data: bookingType, error: typeError } = await supabase
      .from('booking_types')
      .select('id, duration_minutes, is_web_bookable, is_active, unit_type')
      .eq('id', typeId)
      .single()

    if (typeError || !bookingType) {
      return NextResponse.json({ error: '予約種別が見つかりません' }, { status: 404 })
    }
    if (!bookingType.is_active) {
      return NextResponse.json({ error: 'この予約種別は現在利用できません' }, { status: 400 })
    }
    if (source !== 'token' && !bookingType.is_web_bookable) {
      return NextResponse.json({ error: 'この予約種別はWeb予約できません' }, { status: 400 })
    }

    const durationMinutes = bookingType.duration_minutes
    const btUnitType: string = bookingType.unit_type || 'any'

    // 設定取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', [
        'business_hours', 'visible_units', 'unit_count',
        'closed_days', 'unit_types', 'web_booking_min_gap_minutes',
        'web_booking_min_days_ahead', 'web_booking_max_days_ahead',
      ])

    let bhStart = '09:00'
    let bhEnd = '18:00'
    let lunchStart = '12:30'
    let lunchEnd = '14:00'
    let closedDays: string[] = ['日', '祝']
    let visibleUnitsRaw = ''
    let unitCountRaw = ''
    let unitTypesMap: Record<string, string> = {}
    let minGapMinutes = 40
    let minDaysAhead = 1
    let maxDaysAhead = 90

    if (settingsData) {
      for (const row of settingsData) {
        if (row.key === 'business_hours') {
          try {
            const bh = JSON.parse(row.value)
            bhStart = bh.start || '09:00'
            bhEnd = bh.end || '18:00'
            lunchStart = bh.lunch_start || '12:30'
            lunchEnd = bh.lunch_end || '14:00'
          } catch { /* ignore */ }
        }
        if (row.key === 'visible_units') visibleUnitsRaw = row.value
        if (row.key === 'unit_count') unitCountRaw = row.value
        if (row.key === 'closed_days') {
          try { closedDays = JSON.parse(row.value) } catch { /* ignore */ }
        }
        if (row.key === 'unit_types') {
          try { unitTypesMap = JSON.parse(row.value) } catch { /* ignore */ }
        }
        if (row.key === 'web_booking_min_gap_minutes') minGapMinutes = parseInt(row.value) || 40
        if (row.key === 'web_booking_min_days_ahead') minDaysAhead = parseInt(row.value) || 1
        if (row.key === 'web_booking_max_days_ahead') maxDaysAhead = parseInt(row.value) || 90
      }
    }

    let allUnits = parseUnits(visibleUnitsRaw || unitCountRaw || '5')

    // Phase 3: unit_type フィルタ
    if (btUnitType !== 'any') {
      allUnits = allUnits.filter(u => unitTypesMap[String(u)] === btUnitType)
      if (allUnits.length === 0) {
        // ユニットが存在しない場合は全日 unavailable
        const [year, mon] = month.split('-').map(Number)
        const monthEnd = new Date(year, mon, 0)
        const dates: { date: string; available: boolean }[] = []
        for (let d = 1; d <= monthEnd.getDate(); d++) {
          dates.push({ date: `${month}-${String(d).padStart(2, '0')}`, available: false })
        }
        return NextResponse.json({ dates })
      }
    }

    // Phase 5: clinic_holidays テーブル取得
    const { data: holidays } = await supabase
      .from('clinic_holidays')
      .select('holiday_type, day_of_week, specific_date, is_active')
      .eq('is_active', true)

    const weeklyClosedDows = new Set<number>()
    const specificClosedDates = new Set<string>()
    if (holidays) {
      for (const h of holidays) {
        if (h.holiday_type === 'weekly' && h.day_of_week !== null) {
          weeklyClosedDows.add(h.day_of_week)
        }
        if ((h.holiday_type === 'specific' || h.holiday_type === 'national') && h.specific_date) {
          specificClosedDates.add(h.specific_date)
        }
      }
    }

    // 月の範囲を計算
    const [year, mon] = month.split('-').map(Number)
    const monthStart = new Date(year, mon - 1, 1)
    const monthEnd = new Date(year, mon, 0) // 月末日

    // 予約可能範囲
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today.getTime() + minDaysAhead * 24 * 60 * 60 * 1000)
    const maxDate = new Date(today.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)

    // 月の予約・ブロック枠を一括取得
    const rangeStart = `${month}-01T00:00:00+09:00`
    const rangeEndStr = `${month}-${String(monthEnd.getDate()).padStart(2, '0')}T23:59:59+09:00`

    const [appointmentsRes, blockedSlotsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('unit_number, start_time, duration_minutes')
        .eq('is_deleted', false)
        .not('status', 'in', '("cancelled","no_show")')
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEndStr),
      supabase
        .from('blocked_slots')
        .select('unit_number, start_time, end_time')
        .eq('is_deleted', false)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEndStr),
    ])

    const appointments = appointmentsRes.data || []
    const blockedSlots = blockedSlotsRes.data || []

    // 日付ごと・ユニットごとにインデックス
    const appointmentsByDayUnit = new Map<string, OccupiedInterval[]>()
    for (const appt of appointments) {
      const apptStart = new Date(appt.start_time)
      const dayKey = formatDateJST(apptStart)
      const key = `${dayKey}_${appt.unit_number}`
      if (!appointmentsByDayUnit.has(key)) appointmentsByDayUnit.set(key, [])
      appointmentsByDayUnit.get(key)!.push({
        start: apptStart.getTime(),
        end: apptStart.getTime() + appt.duration_minutes * 60 * 1000,
        type: 'appointment',
      })
    }

    const blockedByDayUnit = new Map<string, OccupiedInterval[]>()
    for (const block of blockedSlots) {
      const blockStart = new Date(block.start_time)
      const blockEnd = new Date(block.end_time)
      const dayKey = formatDateJST(blockStart)
      const affectedUnits = block.unit_number === 0 ? allUnits : [block.unit_number]
      for (const u of affectedUnits) {
        const key = `${dayKey}_${u}`
        if (!blockedByDayUnit.has(key)) blockedByDayUnit.set(key, [])
        blockedByDayUnit.get(key)!.push({
          start: blockStart.getTime(),
          end: blockEnd.getTime(),
          type: 'blocked',
        })
      }
    }

    // Phase 4: 最小間隔の有効値
    const effectiveGap = Math.min(durationMinutes, minGapMinutes)
    const effectiveGapMs = effectiveGap * 60 * 1000
    const slotMs = durationMinutes * 60 * 1000

    // 各日の空き判定
    const dates: { date: string; available: boolean }[] = []
    const currentDate = new Date(monthStart)

    while (currentDate <= monthEnd) {
      const dayStr = `${month}-${String(currentDate.getDate()).padStart(2, '0')}`
      const dayDate = new Date(currentDate)

      let available = false

      // 範囲外チェック
      if (dayDate < minDate || dayDate > maxDate) {
        dates.push({ date: dayStr, available: false })
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // 休診日チェック（曜日 — appointment_settings）
      const dayOfWeek = DAY_NAMES[dayDate.getDay()]
      if (closedDays.includes(dayOfWeek)) {
        dates.push({ date: dayStr, available: false })
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // Phase 5: clinic_holidays チェック
      const dow = dayDate.getDay()
      if (weeklyClosedDows.has(dow) || specificClosedDates.has(dayStr)) {
        dates.push({ date: dayStr, available: false })
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // 各ユニットの空き枠チェック
      const windowStart = parseTimeToTimestamp(dayStr, bhStart)
      const windowEnd = parseTimeToTimestamp(dayStr, bhEnd)
      const lunchS = parseTimeToTimestamp(dayStr, lunchStart)
      const lunchE = parseTimeToTimestamp(dayStr, lunchEnd)

      for (const unit of allUnits) {
        const key = `${dayStr}_${unit}`
        const occupied: OccupiedInterval[] = [
          ...(appointmentsByDayUnit.get(key) || []),
          ...(blockedByDayUnit.get(key) || []),
        ]
        // 昼休み
        if (lunchS < windowEnd && lunchE > windowStart) {
          occupied.push({ start: lunchS, end: lunchE, type: 'lunch' })
        }

        // Phase 4: 最小間隔を考慮した空き判定
        if (hasFreeSlotWithGap(windowStart, windowEnd, occupied, durationMinutes, slotMs, effectiveGapMs)) {
          available = true
          break
        }
      }

      dates.push({ date: dayStr, available })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({ dates })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Phase 4: 最小間隔を考慮した空き枠判定
function hasFreeSlotWithGap(
  windowStart: number,
  windowEnd: number,
  occupied: OccupiedInterval[],
  minDurationMinutes: number,
  slotMs: number,
  effectiveGapMs: number,
): boolean {
  const sorted = [...occupied]
    .filter(o => o.end > windowStart && o.start < windowEnd)
    .sort((a, b) => a.start - b.start)

  // マージして空き区間を求める
  const merged: { start: number; end: number }[] = []
  for (const interval of sorted) {
    const clipped = {
      start: Math.max(interval.start, windowStart),
      end: Math.min(interval.end, windowEnd),
    }
    if (merged.length > 0 && clipped.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, clipped.end)
    } else {
      merged.push({ ...clipped })
    }
  }

  const minMs = minDurationMinutes * 60 * 1000
  const freeSlots: { start: number; end: number }[] = []
  let cursor = windowStart

  for (const occ of merged) {
    if (occ.start > cursor && occ.start - cursor >= minMs) {
      freeSlots.push({ start: cursor, end: occ.start })
    }
    cursor = Math.max(cursor, occ.end)
  }
  if (windowEnd > cursor && windowEnd - cursor >= minMs) {
    freeSlots.push({ start: cursor, end: windowEnd })
  }

  // 各空き区間内の30分刻みスロットに対して最小間隔チェック
  for (const interval of freeSlots) {
    let slotCursor = interval.start
    while (slotCursor + slotMs <= interval.end) {
      const slotStart = slotCursor
      const slotEnd = slotCursor + slotMs

      // 直前・直後の占有区間を探す
      let prevEnd: { end: number; type: string } | null = null
      let nextStart: { start: number; type: string } | null = null

      for (const occ of sorted) {
        if (occ.end <= slotStart) prevEnd = { end: occ.end, type: occ.type }
        else if (occ.start >= slotEnd && !nextStart) { nextStart = { start: occ.start, type: occ.type }; break }
      }

      let valid = true

      // 前の隙間チェック（境界は除外）
      if (prevEnd && prevEnd.type === 'appointment') {
        const gap = slotStart - prevEnd.end
        if (gap > 0 && gap < effectiveGapMs) valid = false
      }

      // 後の隙間チェック（境界は除外）
      if (valid && nextStart && nextStart.type === 'appointment') {
        const gap = nextStart.start - slotEnd
        if (gap > 0 && gap < effectiveGapMs) valid = false
      }

      if (valid) return true

      slotCursor += 30 * 60 * 1000
    }
  }

  return false
}

function parseUnits(raw: string): number[] {
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
  }
  return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 8).sort((a, b) => a - b)
}

function formatDateJST(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

function parseTimeToTimestamp(dateStr: string, time: string): number {
  return new Date(`${dateStr}T${time}:00+09:00`).getTime()
}
