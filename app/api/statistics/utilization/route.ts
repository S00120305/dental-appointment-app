import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date と end_date は必須です' }, { status: 400 })
    }

    const rangeStart = `${startDate}T00:00:00+09:00`
    const rangeEnd = `${endDate}T23:59:59+09:00`

    // 予約データ取得
    const { data, error } = await supabase
      .from('appointments')
      .select('id, unit_number, start_time, duration_minutes, status')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 設定取得（診療時間, ユニット数）
    const { data: settingsData } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['business_hours', 'visible_units'])

    let dailyMinutes = 540 // default: 9h
    let lunchMinutes = 90  // default: 1.5h
    let unitCount = 5
    for (const s of settingsData || []) {
      if (s.key === 'business_hours') {
        try {
          const bh = JSON.parse(s.value)
          const [sh, sm] = (bh.start || '09:00').split(':').map(Number)
          const [eh, em] = (bh.end || '18:00').split(':').map(Number)
          dailyMinutes = (eh * 60 + em) - (sh * 60 + sm)
          if (bh.lunch_start && bh.lunch_end) {
            const [lsh, lsm] = bh.lunch_start.split(':').map(Number)
            const [leh, lem] = bh.lunch_end.split(':').map(Number)
            lunchMinutes = (leh * 60 + lem) - (lsh * 60 + lsm)
          }
        } catch { /* ignore */ }
      }
      if (s.key === 'visible_units') {
        const trimmed = s.value.trim()
        if (trimmed.includes(',')) {
          unitCount = trimmed.split(',').filter(Boolean).length
        } else {
          unitCount = parseInt(trimmed) || 5
        }
      }
    }

    const effectiveDailyMinutes = dailyMinutes - lunchMinutes

    // 休診日取得
    const { data: holidays } = await supabase
      .from('clinic_holidays')
      .select('holiday_type, day_of_week, specific_date, is_active')

    const weeklyClosedDays = new Set<number>()
    const holidayDates = new Set<string>()
    for (const h of holidays || []) {
      if (h.holiday_type === 'weekly' && h.day_of_week !== null) {
        weeklyClosedDays.add(h.day_of_week)
      }
      if ((h.holiday_type === 'specific' || h.holiday_type === 'national') && h.specific_date && h.is_active) {
        holidayDates.add(h.specific_date)
      }
    }

    // 営業日数を計算
    const appointments = data || []
    const startD = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    let businessDays = 0
    const dailyMap: Record<string, { date: string; bookedMinutes: number; count: number }> = {}
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(d)
      const isHoliday = weeklyClosedDays.has(d.getDay()) || holidayDates.has(ds)
      if (!isHoliday) {
        businessDays++
        dailyMap[ds] = { date: ds, bookedMinutes: 0, count: 0 }
      }
    }

    // ユニット別集計
    const unitMap: Record<number, { unit: number; bookedMinutes: number; count: number }> = {}
    // 時間帯ヒートマップ (hour × dow)
    const heatmap: Record<string, number> = {}

    for (const a of appointments) {
      const ds = a.start_time.slice(0, 10)
      const hour = parseInt(a.start_time.slice(11, 13))
      const dow = new Date(a.start_time).getDay()

      if (dailyMap[ds]) {
        dailyMap[ds].bookedMinutes += a.duration_minutes
        dailyMap[ds].count++
      }

      if (!unitMap[a.unit_number]) {
        unitMap[a.unit_number] = { unit: a.unit_number, bookedMinutes: 0, count: 0 }
      }
      unitMap[a.unit_number].bookedMinutes += a.duration_minutes
      unitMap[a.unit_number].count++

      const hKey = `${hour}-${dow}`
      heatmap[hKey] = (heatmap[hKey] || 0) + 1
    }

    // KPIs
    const totalBookedMinutes = appointments.reduce((s, a) => s + a.duration_minutes, 0)
    const totalAvailableMinutes = businessDays * effectiveDailyMinutes * unitCount
    const overallRate = totalAvailableMinutes > 0
      ? Math.round(totalBookedMinutes / totalAvailableMinutes * 1000) / 10
      : 0
    const avgPerDay = businessDays > 0
      ? Math.round(appointments.length / businessDays * 10) / 10
      : 0

    // 前期間
    const daysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEndD = new Date(startD.getTime() - 1000 * 60 * 60 * 24)
    const prevStartD = new Date(prevEndD.getTime() - (daysDiff - 1) * 1000 * 60 * 60 * 24)

    const { data: prevData } = await supabase
      .from('appointments')
      .select('duration_minutes')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', `${formatDate(prevStartD)}T00:00:00+09:00`)
      .lte('start_time', `${formatDate(prevEndD)}T23:59:59+09:00`)

    let prevBusinessDays = 0
    for (let d = new Date(prevStartD); d <= prevEndD; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(d)
      if (!weeklyClosedDays.has(d.getDay()) && !holidayDates.has(ds)) {
        prevBusinessDays++
      }
    }
    const prevBookedMinutes = (prevData || []).reduce((s, a) => s + a.duration_minutes, 0)
    const prevAvailable = prevBusinessDays * effectiveDailyMinutes * unitCount
    const prevRate = prevAvailable > 0 ? Math.round(prevBookedMinutes / prevAvailable * 1000) / 10 : 0
    const prevAvgPerDay = prevBusinessDays > 0
      ? Math.round((prevData || []).length / prevBusinessDays * 10) / 10
      : 0

    // ユニット別データ
    const unitData = Object.values(unitMap)
      .sort((a, b) => a.unit - b.unit)
      .map(u => {
        const available = businessDays * effectiveDailyMinutes
        return {
          unit: u.unit,
          rate: available > 0 ? Math.round(u.bookedMinutes / available * 1000) / 10 : 0,
          count: u.count,
          bookedHours: Math.round(u.bookedMinutes / 60 * 10) / 10,
          freeHours: Math.round((available - u.bookedMinutes) / 60 * 10) / 10,
        }
      })

    // 日別稼働率
    const dailyData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        rate: Math.round(d.bookedMinutes / (effectiveDailyMinutes * unitCount) * 1000) / 10,
        count: d.count,
      }))

    // ヒートマップ
    const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
    const hourlyHeatmap: { hour: number; dow: string; count: number }[] = []
    for (let h = 8; h <= 19; h++) {
      for (let d = 0; d <= 6; d++) {
        hourlyHeatmap.push({
          hour: h,
          dow: DOW_LABELS[d],
          count: heatmap[`${h}-${d}`] || 0,
        })
      }
    }

    return NextResponse.json({
      overallRate,
      avgPerDay,
      prev: { overallRate: prevRate, avgPerDay: prevAvgPerDay },
      unitData,
      dailyData,
      hourlyHeatmap,
      businessDays,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
