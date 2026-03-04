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

    // 前期間の範囲を先に計算
    const startD = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    const daysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEndD = new Date(startD.getTime() - 1000 * 60 * 60 * 24)
    const prevStartD = new Date(prevEndD.getTime() - (daysDiff - 1) * 1000 * 60 * 60 * 24)
    const prevStart = formatDate(prevStartD)
    const prevEnd = formatDate(prevEndD)

    // 当期間 + 前期間を並列取得
    const [currentResult, prevResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, status, start_time, duration_minutes, booking_source')
        .eq('is_deleted', false)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd),
      supabase
        .from('appointments')
        .select('id, status')
        .eq('is_deleted', false)
        .gte('start_time', `${prevStart}T00:00:00+09:00`)
        .lte('start_time', `${prevEnd}T23:59:59+09:00`),
    ])

    if (currentResult.error) {
      console.error('DB error:', currentResult.error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const appointments = currentResult.data || []

    // KPI
    const total = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length
    const visited = appointments.filter(a => a.status === 'checked_in' || a.status === 'completed').length
    const cancelled = appointments.filter(a => a.status === 'cancelled').length
    const noShow = appointments.filter(a => a.status === 'no_show').length

    const prevAppts = prevResult.data || []
    const prevTotal = prevAppts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length
    const prevVisited = prevAppts.filter(a => a.status === 'checked_in' || a.status === 'completed').length
    const prevCancelled = prevAppts.filter(a => a.status === 'cancelled').length
    const prevNoShow = prevAppts.filter(a => a.status === 'no_show').length

    // 日別推移
    const dailyMap: Record<string, { date: string; total: number; visited: number; cancelled: number }> = {}
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(d)
      dailyMap[ds] = { date: ds, total: 0, visited: 0, cancelled: 0 }
    }
    for (const a of appointments) {
      const ds = a.start_time.slice(0, 10)
      if (!dailyMap[ds]) continue
      if (a.status !== 'cancelled' && a.status !== 'no_show') dailyMap[ds].total++
      if (a.status === 'checked_in' || a.status === 'completed') dailyMap[ds].visited++
      if (a.status === 'cancelled') dailyMap[ds].cancelled++
    }
    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

    // 曜日別集計
    const dowData = [0, 1, 2, 3, 4, 5, 6].map(dow => {
      const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
      const daysOfDow = dailyData.filter(d => new Date(d.date + 'T00:00:00').getDay() === dow)
      const totalForDow = daysOfDow.reduce((s, d) => s + d.total, 0)
      const count = daysOfDow.length || 1
      return { dow: DOW_LABELS[dow], avg: Math.round(totalForDow / count * 10) / 10, total: totalForDow }
    })

    // キャンセル率
    const allCount = total + cancelled + noShow
    const cancelRate = allCount > 0 ? Math.round((cancelled + noShow) / allCount * 1000) / 10 : 0

    return NextResponse.json({
      total,
      visited,
      cancelled,
      noShow,
      cancelRate,
      prev: { total: prevTotal, visited: prevVisited, cancelled: prevCancelled, noShow: prevNoShow },
      dailyData,
      dowData,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
