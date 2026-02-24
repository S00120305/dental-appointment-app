import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

type OccupiedInterval = { start: number; end: number }

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

    // 予約種別を取得
    const { data: bookingType, error: typeError } = await supabase
      .from('booking_types')
      .select('id, duration_minutes, is_web_bookable, is_active')
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

    // 設定取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', [
        'business_hours', 'visible_units', 'unit_count',
        'closed_days',
        'web_booking_min_days_ahead', 'web_booking_max_days_ahead',
      ])

    let bhStart = '09:00'
    let bhEnd = '18:00'
    let lunchStart = '12:30'
    let lunchEnd = '14:00'
    let closedDays: string[] = ['日', '祝']
    let visibleUnitsRaw = ''
    let unitCountRaw = ''
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
        if (row.key === 'web_booking_min_days_ahead') minDaysAhead = parseInt(row.value) || 1
        if (row.key === 'web_booking_max_days_ahead') maxDaysAhead = parseInt(row.value) || 90
      }
    }

    const allUnits = parseUnits(visibleUnitsRaw || unitCountRaw || '5')

    // 日付バリデーション
    const targetDate = new Date(date + 'T00:00:00+09:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today.getTime() + minDaysAhead * 24 * 60 * 60 * 1000)
    const maxDate = new Date(today.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)

    if (targetDate < minDate || targetDate > maxDate) {
      return NextResponse.json({ error: 'この日は予約可能期間外です', slots: [] }, { status: 400 })
    }

    // 休診日チェック
    const dayOfWeek = DAY_NAMES[targetDate.getUTCDay()]
    if (closedDays.includes(dayOfWeek)) {
      return NextResponse.json({ error: 'この日は休診日です', slots: [] }, { status: 400 })
    }

    // 対象日の予約・ブロック枠を取得
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

    // ユニットごとにインデックス
    const occupiedByUnit = new Map<number, OccupiedInterval[]>()
    for (const appt of appointments) {
      const s = new Date(appt.start_time).getTime()
      if (!occupiedByUnit.has(appt.unit_number)) occupiedByUnit.set(appt.unit_number, [])
      occupiedByUnit.get(appt.unit_number)!.push({
        start: s,
        end: s + appt.duration_minutes * 60 * 1000,
      })
    }
    for (const block of blockedSlots) {
      const affectedUnits = block.unit_number === 0 ? allUnits : [block.unit_number]
      for (const u of affectedUnits) {
        if (!occupiedByUnit.has(u)) occupiedByUnit.set(u, [])
        occupiedByUnit.get(u)!.push({
          start: new Date(block.start_time).getTime(),
          end: new Date(block.end_time).getTime(),
        })
      }
    }

    // 時間窓
    const windowStart = parseTimeToTimestamp(date, bhStart)
    const windowEnd = parseTimeToTimestamp(date, bhEnd)
    const lunchS = parseTimeToTimestamp(date, lunchStart)
    const lunchE = parseTimeToTimestamp(date, lunchEnd)

    // 全ユニットの空き時間をマージして、ユニーク時間枠を返す
    const availableTimesSet = new Set<number>()
    const slotMs = durationMinutes * 60 * 1000

    for (const unit of allUnits) {
      const occupied: OccupiedInterval[] = [
        ...(occupiedByUnit.get(unit) || []),
      ]
      // 昼休み
      if (lunchS < windowEnd && lunchE > windowStart) {
        occupied.push({ start: lunchS, end: lunchE })
      }

      const freeIntervals = findFreeSlots(windowStart, windowEnd, occupied, durationMinutes)

      // 空き区間を30分刻みのスロットに分割
      for (const interval of freeIntervals) {
        let cursor = interval.start
        while (cursor + slotMs <= interval.end) {
          availableTimesSet.add(cursor)
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

function findFreeSlots(
  windowStart: number,
  windowEnd: number,
  occupied: OccupiedInterval[],
  minDurationMinutes: number
): OccupiedInterval[] {
  const sorted = [...occupied]
    .filter(o => o.end > windowStart && o.start < windowEnd)
    .sort((a, b) => a.start - b.start)

  const merged: OccupiedInterval[] = []
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

  const freeSlots: OccupiedInterval[] = []
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
