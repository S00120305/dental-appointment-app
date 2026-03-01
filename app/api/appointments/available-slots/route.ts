import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const MAX_RESULTS = 20
const MAX_DAYS = 30

type OccupiedInterval = { start: number; end: number }

type AvailableSlot = {
  date: string
  unit_number: number
  start_time: string
  end_time: string
  duration_minutes: number
}

// GET: 空き枠検索
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const durationMinutes = parseInt(searchParams.get('duration_minutes') || '30')
    const timeRange = searchParams.get('time_range') || 'all'
    const daysOfWeekParam = searchParams.get('days_of_week')
    const customTimeStart = searchParams.get('time_start')
    const customTimeEnd = searchParams.get('time_end')

    // 曜日フィルタ（0=日,1=月,...6=土）
    const daysOfWeek: number[] = daysOfWeekParam
      ? daysOfWeekParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 6)
      : []

    // バリデーション
    if (!startDate || !endDate) {
      return NextResponse.json({ error: '開始日と終了日は必須です' }, { status: 400 })
    }
    if (durationMinutes < 5 || durationMinutes > 180) {
      return NextResponse.json({ error: '所要時間は5〜180分で指定してください' }, { status: 400 })
    }

    const start = new Date(startDate + 'T00:00:00+09:00')
    const end = new Date(endDate + 'T00:00:00+09:00')
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diffDays > MAX_DAYS) {
      return NextResponse.json({ error: `検索期間は最大${MAX_DAYS}日間です` }, { status: 400 })
    }
    if (diffDays < 1) {
      return NextResponse.json({ error: '終了日は開始日以降にしてください' }, { status: 400 })
    }

    // 複数ユニット対応 (unit_numbers=1,3,5)
    const unitNumbersParam = searchParams.get('unit_numbers')
    const unitNumber = parseInt(searchParams.get('unit_number') || '0')

    // 設定を取得
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['business_hours', 'unit_count', 'visible_units'])

    let bhStart = '09:00'
    let bhEnd = '18:00'
    let lunchStart = '12:30'
    let lunchEnd = '14:00'
    let visibleUnitsRaw = ''
    let unitCountRaw = ''

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
      }
    }

    // visible_units をパース（"1,3,5" or 旧形式 "4"）
    function parseUnits(raw: string): number[] {
      const trimmed = raw.trim()
      if (/^\d+$/.test(trimmed)) {
        const n = parseInt(trimmed, 10)
        if (n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => i + 1)
      }
      return trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 8).sort((a, b) => a - b)
    }
    const allUnits = parseUnits(visibleUnitsRaw || unitCountRaw || '5')

    // 対象ユニットリスト
    let targetUnits: number[]
    if (unitNumbersParam) {
      // 新形式: カンマ区切り複数ユニット
      targetUnits = unitNumbersParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && allUnits.includes(n))
      if (targetUnits.length === 0) targetUnits = allUnits
    } else if (unitNumber > 0) {
      // 旧形式: 単一ユニット
      targetUnits = [unitNumber]
    } else {
      targetUnits = allUnits
    }

    // 休診日を取得
    const { data: holidaysData } = await supabase
      .from('clinic_holidays')
      .select('holiday_type, specific_date, day_of_week')
      .eq('is_active', true)

    const weeklyClosedDays = new Set<number>()
    const specificHolidays = new Set<string>()
    if (holidaysData) {
      for (const h of holidaysData) {
        if (h.holiday_type === 'weekly' && h.day_of_week !== null) {
          weeklyClosedDays.add(h.day_of_week)
        } else if ((h.holiday_type === 'specific' || h.holiday_type === 'national') && h.specific_date) {
          specificHolidays.add(h.specific_date)
        }
      }
    }

    // 期間内の予約を一括取得
    const rangeStart = `${startDate}T00:00:00+09:00`
    const rangeEnd = `${endDate}T23:59:59+09:00`

    const [appointmentsRes, blockedSlotsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('unit_number, start_time, duration_minutes, status')
        .eq('is_deleted', false)
        .not('status', 'in', '("cancelled","no_show")')
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd),
      supabase
        .from('blocked_slots')
        .select('unit_number, start_time, end_time')
        .eq('is_deleted', false)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd),
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
      })
    }

    const blockedByDayUnit = new Map<string, OccupiedInterval[]>()
    for (const block of blockedSlots) {
      const blockStart = new Date(block.start_time)
      const blockEnd = new Date(block.end_time)
      const dayKey = formatDateJST(blockStart)

      const affectedUnits = block.unit_number === 0 ? targetUnits : [block.unit_number]
      for (const u of affectedUnits) {
        const key = `${dayKey}_${u}`
        if (!blockedByDayUnit.has(key)) blockedByDayUnit.set(key, [])
        blockedByDayUnit.get(key)!.push({
          start: blockStart.getTime(),
          end: blockEnd.getTime(),
        })
      }
    }

    // 各日・各ユニットで空き枠算出
    const slots: AvailableSlot[] = []
    let totalFound = 0

    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dayStr = formatDateJST(currentDate)

      // 曜日フィルタ: getDay()はUTCなのでJSTで計算
      const jstDate = new Date(currentDate.getTime() + 9 * 60 * 60 * 1000)
      const dayOfWeek = jstDate.getUTCDay()
      if (daysOfWeek.length > 0 && !daysOfWeek.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // 休診日スキップ
      if (weeklyClosedDays.has(dayOfWeek) || specificHolidays.has(dayStr)) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // 診療時間の開始・終了をその日のタイムスタンプに変換
      let windowStart = parseTimeToTimestamp(dayStr, bhStart)
      let windowEnd = parseTimeToTimestamp(dayStr, bhEnd)

      // time_range フィルタ
      if (timeRange === 'custom' && customTimeStart && customTimeEnd) {
        // カスタム時間帯（営業時間でclamp）
        windowStart = Math.max(windowStart, parseTimeToTimestamp(dayStr, customTimeStart))
        windowEnd = Math.min(windowEnd, parseTimeToTimestamp(dayStr, customTimeEnd))
      } else if (timeRange === 'morning') {
        windowEnd = Math.min(windowEnd, parseTimeToTimestamp(dayStr, '12:00'))
      } else if (timeRange === 'afternoon') {
        windowStart = Math.max(windowStart, parseTimeToTimestamp(dayStr, '13:00'))
      }

      if (windowStart >= windowEnd) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      for (const unit of targetUnits) {
        const key = `${dayStr}_${unit}`

        // 占有区間を収集
        const occupied: OccupiedInterval[] = [
          ...(appointmentsByDayUnit.get(key) || []),
          ...(blockedByDayUnit.get(key) || []),
        ]

        // 昼休みも占有区間に追加（time_range=all の場合のみ影響）
        const lunchS = parseTimeToTimestamp(dayStr, lunchStart)
        const lunchE = parseTimeToTimestamp(dayStr, lunchEnd)
        if (lunchS < windowEnd && lunchE > windowStart) {
          occupied.push({ start: lunchS, end: lunchE })
        }

        // 空き枠を算出
        const freeSlots = findFreeSlots(windowStart, windowEnd, occupied, durationMinutes)

        for (const free of freeSlots) {
          totalFound++
          if (slots.length < MAX_RESULTS) {
            const freeStartDate = new Date(free.start)
            const freeEndDate = new Date(free.end)
            slots.push({
              date: dayStr,
              unit_number: unit,
              start_time: formatToJSTISO(freeStartDate),
              end_time: formatToJSTISO(freeEndDate),
              duration_minutes: Math.round((free.end - free.start) / (60 * 1000)),
            })
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({
      slots,
      total: totalFound,
      has_more: totalFound > MAX_RESULTS,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 空き時間帯を算出
function findFreeSlots(
  windowStart: number,
  windowEnd: number,
  occupied: OccupiedInterval[],
  minDuration: number
): OccupiedInterval[] {
  // 占有区間をソートしてマージ
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

  // 空き区間を抽出
  const freeSlots: OccupiedInterval[] = []
  const minMs = minDuration * 60 * 1000

  let cursor = windowStart
  for (const occ of merged) {
    if (occ.start > cursor) {
      const gap = occ.start - cursor
      if (gap >= minMs) {
        freeSlots.push({ start: cursor, end: occ.start })
      }
    }
    cursor = Math.max(cursor, occ.end)
  }

  // 最後の空き
  if (windowEnd > cursor) {
    const gap = windowEnd - cursor
    if (gap >= minMs) {
      freeSlots.push({ start: cursor, end: windowEnd })
    }
  }

  return freeSlots
}

// JST日付文字列取得 (YYYY-MM-DD)
function formatDateJST(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

// "HH:mm" + 日付文字列 → UTC タイムスタンプ (JST基準)
function parseTimeToTimestamp(dateStr: string, time: string): number {
  return new Date(`${dateStr}T${time}:00+09:00`).getTime()
}

// Date → JST ISO文字列
function formatToJSTISO(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const iso = jst.toISOString().replace('Z', '')
  // YYYY-MM-DDTHH:mm:ss+09:00
  return iso.split('.')[0] + '+09:00'
}
