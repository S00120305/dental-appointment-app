import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

type OccupiedInterval = { start: number; end: number; type: 'appointment' | 'lunch' | 'blocked' | 'boundary' }

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

// GET: 指定日の空き時間枠一覧（公開API）
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
    const date = searchParams.get('date') // YYYY-MM-DD

    if (!typeId || !date) {
      return NextResponse.json({ error: 'type_id と date は必須です' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date の形式は YYYY-MM-DD です' }, { status: 400 })
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

    // duration パラメータがあればそちらを優先（トークン予約で所要時間変更時）
    const durationParam = searchParams.get('duration')
    const durationMinutes = (durationParam && parseInt(durationParam) >= 10) ? parseInt(durationParam) : bookingType.duration_minutes
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

    // Phase 3: unit_type フィルタ — booking_type の unit_type に一致するユニットのみ
    if (btUnitType !== 'any') {
      allUnits = allUnits.filter(u => unitTypesMap[String(u)] === btUnitType)
      if (allUnits.length === 0) {
        return NextResponse.json({ date, slots: [], duration_minutes: durationMinutes })
      }
    }

    // 日付バリデーション
    const targetDate = new Date(date + 'T00:00:00+09:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today.getTime() + minDaysAhead * 24 * 60 * 60 * 1000)
    const maxDate = new Date(today.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)

    if (targetDate < minDate || targetDate > maxDate) {
      return NextResponse.json({ error: 'この日は予約可能期間外です', slots: [] }, { status: 400 })
    }

    // 休診日チェック（曜日）
    const dayOfWeek = DAY_NAMES[targetDate.getUTCDay()]
    if (closedDays.includes(dayOfWeek)) {
      return NextResponse.json({ error: 'この日は休診日です', slots: [] }, { status: 400 })
    }

    // Phase 5: clinic_holidays テーブルからの休診日チェック
    const { data: holidays } = await supabase
      .from('clinic_holidays')
      .select('holiday_type, day_of_week, specific_date, is_active')
      .eq('is_active', true)

    if (holidays) {
      const jstDow = targetDate.getUTCDay() // 0=日,1=月,...
      for (const h of holidays) {
        if (h.holiday_type === 'weekly' && h.day_of_week === jstDow) {
          return NextResponse.json({ error: 'この日は休診日です', slots: [] }, { status: 400 })
        }
        if ((h.holiday_type === 'specific' || h.holiday_type === 'national') && h.specific_date === date) {
          return NextResponse.json({ error: 'この日は休診日です', slots: [] }, { status: 400 })
        }
      }
    }

    // 対象日の予約・ブロック枠を取得（slide_from_id も取得）
    const dayStart = `${date}T00:00:00+09:00`
    const dayEnd = `${date}T23:59:59+09:00`

    const [appointmentsRes, blockedSlotsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, unit_number, start_time, duration_minutes, slide_from_id')
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

    // スライドペアのIDセットを構築
    const slidePairIds = new Set<string>()
    for (const appt of appointments) {
      if (appt.slide_from_id) {
        slidePairIds.add(appt.id)
        slidePairIds.add(appt.slide_from_id)
      }
    }

    // ユニットごとにインデックス（type付き）
    const occupiedByUnit = new Map<number, OccupiedInterval[]>()
    // 予約IDとインターバルのマッピング（スライドペア判定用）
    const apptIntervalMap = new Map<string, { unit: number; interval: OccupiedInterval }>()

    for (const appt of appointments) {
      const s = new Date(appt.start_time).getTime()
      const interval: OccupiedInterval = {
        start: s,
        end: s + appt.duration_minutes * 60 * 1000,
        type: 'appointment',
      }
      if (!occupiedByUnit.has(appt.unit_number)) occupiedByUnit.set(appt.unit_number, [])
      occupiedByUnit.get(appt.unit_number)!.push(interval)
      apptIntervalMap.set(appt.id, { unit: appt.unit_number, interval })
    }
    for (const block of blockedSlots) {
      const affectedUnits = block.unit_number === 0 ? allUnits : [block.unit_number]
      for (const u of affectedUnits) {
        if (!occupiedByUnit.has(u)) occupiedByUnit.set(u, [])
        occupiedByUnit.get(u)!.push({
          start: new Date(block.start_time).getTime(),
          end: new Date(block.end_time).getTime(),
          type: 'blocked',
        })
      }
    }

    // 時間窓
    const windowStart = parseTimeToTimestamp(date, bhStart)
    const windowEnd = parseTimeToTimestamp(date, bhEnd)
    const lunchS = parseTimeToTimestamp(date, lunchStart)
    const lunchE = parseTimeToTimestamp(date, lunchEnd)

    // Phase 4: 最小間隔の有効値
    const effectiveGap = Math.min(durationMinutes, minGapMinutes)
    const effectiveGapMs = effectiveGap * 60 * 1000

    // 全ユニットの空き時間をマージして、ユニーク時間枠を返す
    const availableTimesSet = new Set<number>()
    const slotMs = durationMinutes * 60 * 1000

    for (const unit of allUnits) {
      const occupied: OccupiedInterval[] = [
        ...(occupiedByUnit.get(unit) || []),
      ]
      // 昼休み
      if (lunchS < windowEnd && lunchE > windowStart) {
        occupied.push({ start: lunchS, end: lunchE, type: 'lunch' })
      }

      // ソート済みのoccupied intervals（mergeなし、個別に保持してgapチェック用）
      const sortedOccupied = [...occupied]
        .filter(o => o.end > windowStart && o.start < windowEnd)
        .sort((a, b) => a.start - b.start)

      const freeIntervals = findFreeSlots(windowStart, windowEnd, occupied, durationMinutes)

      // 空き区間を30分刻みのスロットに分割 + 最小間隔チェック
      for (const interval of freeIntervals) {
        let cursor = interval.start
        while (cursor + slotMs <= interval.end) {
          const slotStart = cursor
          const slotEnd = cursor + slotMs

          // Phase 4: 最小間隔チェック
          if (passesMinGapCheck(slotStart, slotEnd, sortedOccupied, windowStart, windowEnd, effectiveGapMs, unit, appointments, slidePairIds)) {
            availableTimesSet.add(cursor)
          }

          cursor += 30 * 60 * 1000 // 30分刻み
        }
      }
    }

    // 時間順にソートしてレスポンス構築
    const sortedTimes = Array.from(availableTimesSet).sort((a, b) => a - b)

    // 午前/午後の境界
    const noonTs = parseTimeToTimestamp(date, '12:00')

    const slots = sortedTimes.map(ts => {
      const d = new Date(ts)
      const h = (d.getUTCHours() + 9) % 24
      const minutes = String(d.getUTCMinutes()).padStart(2, '0')
      return {
        time: `${String(h).padStart(2, '0')}:${minutes}`,
        period: ts < noonTs ? 'morning' as const : 'afternoon' as const,
      }
    })

    return NextResponse.json({ date, slots, duration_minutes: durationMinutes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Phase 4: 最小間隔チェック
function passesMinGapCheck(
  slotStart: number,
  slotEnd: number,
  sortedOccupied: OccupiedInterval[],
  windowStart: number,
  windowEnd: number,
  effectiveGapMs: number,
  unit: number,
  appointments: { id: string; unit_number: number; start_time: string; duration_minutes: number; slide_from_id: string | null }[],
  slidePairIds: Set<string>,
): boolean {
  // 直前・直後の占有区間を探す
  let prevOcc: OccupiedInterval | null = null
  let nextOcc: OccupiedInterval | null = null

  for (const occ of sortedOccupied) {
    if (occ.end <= slotStart) {
      prevOcc = occ
    } else if (occ.start >= slotEnd && !nextOcc) {
      nextOcc = occ
      break
    }
  }

  // 前の隙間チェック
  if (prevOcc) {
    const isBoundary = prevOcc.type === 'lunch' || prevOcc.type === 'blocked' || prevOcc.type === 'boundary'
    // スライドペア間はスキップ
    const isSlideRelated = isSlidePairGap(prevOcc, slotStart, slotEnd, unit, appointments, slidePairIds)

    if (!isBoundary && !isSlideRelated) {
      const gap = slotStart - prevOcc.end
      if (gap > 0 && gap < effectiveGapMs) return false
    }
  } else {
    // 直前が診療開始（境界）→ チェック不要
  }

  // 後の隙間チェック
  if (nextOcc) {
    const isBoundary = nextOcc.type === 'lunch' || nextOcc.type === 'blocked' || nextOcc.type === 'boundary'
    const isSlideRelated = isSlidePairGap(nextOcc, slotStart, slotEnd, unit, appointments, slidePairIds)

    if (!isBoundary && !isSlideRelated) {
      const gap = nextOcc.start - slotEnd
      if (gap > 0 && gap < effectiveGapMs) return false
    }
  } else {
    // 直後が診療終了（境界）→ チェック不要
  }

  return true
}

// スライドペア間のギャップかどうか判定
function isSlidePairGap(
  _occ: OccupiedInterval,
  _slotStart: number,
  _slotEnd: number,
  _unit: number,
  _appointments: { id: string; unit_number: number; slide_from_id: string | null }[],
  _slidePairIds: Set<string>,
): boolean {
  // スライドは同一患者のユニット移動なので、基本的に同一ユニット内では関係ない
  // 将来的に必要になったら拡張
  return false
}

function findFreeSlots(
  windowStart: number,
  windowEnd: number,
  occupied: OccupiedInterval[],
  minDurationMinutes: number
): { start: number; end: number }[] {
  const sorted = [...occupied]
    .filter(o => o.end > windowStart && o.start < windowEnd)
    .sort((a, b) => a.start - b.start)

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

  const freeSlots: { start: number; end: number }[] = []
  const minMs = minDurationMinutes * 60 * 1000
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

  return freeSlots
}

function parseUnits(raw: string): number[] {
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
  }
  return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 8).sort((a, b) => a - b)
}

function parseTimeToTimestamp(dateStr: string, time: string): number {
  return new Date(`${dateStr}T${time}:00+09:00`).getTime()
}
