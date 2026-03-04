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

    // 当期間
    const { data, error } = await supabase
      .from('appointments')
      .select('id, booking_source, start_time')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    const appointments = data || []

    // 経路別集計
    const sourceLabels: Record<string, string> = {
      internal: '受付',
      web: 'Web予約',
      phone: '電話',
      line: 'LINE',
    }
    const sourceCounts: Record<string, number> = {}
    for (const a of appointments) {
      const source = a.booking_source || 'internal'
      sourceCounts[source] = (sourceCounts[source] || 0) + 1
    }

    const total = appointments.length
    const sourceData = Object.entries(sourceCounts)
      .map(([source, count]) => ({
        source,
        label: sourceLabels[source] || source,
        count,
        rate: total > 0 ? Math.round(count / total * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // 前期間比較
    const startD = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    const daysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEndD = new Date(startD.getTime() - 1000 * 60 * 60 * 24)
    const prevStartD = new Date(prevEndD.getTime() - (daysDiff - 1) * 1000 * 60 * 60 * 24)

    const { data: prevData } = await supabase
      .from('appointments')
      .select('booking_source')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', `${formatDate(prevStartD)}T00:00:00+09:00`)
      .lte('start_time', `${formatDate(prevEndD)}T23:59:59+09:00`)

    const prevSourceCounts: Record<string, number> = {}
    for (const a of prevData || []) {
      const source = a.booking_source || 'internal'
      prevSourceCounts[source] = (prevSourceCounts[source] || 0) + 1
    }

    // 月別推移（過去6ヶ月）
    const monthlyData: { month: string; [key: string]: string | number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0)
      monthlyData.push({
        month: `${mStart.getFullYear()}/${mStart.getMonth() + 1}`,
        _start: formatDate(mStart),
        _end: formatDate(mEnd),
      })
    }

    // 月別データを一括取得
    if (monthlyData.length > 0) {
      const mFirst = monthlyData[0]._start as string
      const mLast = monthlyData[monthlyData.length - 1]._end as string

      const { data: monthlyAppts } = await supabase
        .from('appointments')
        .select('booking_source, start_time')
        .eq('is_deleted', false)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .gte('start_time', `${mFirst}T00:00:00+09:00`)
        .lte('start_time', `${mLast}T23:59:59+09:00`)

      for (const md of monthlyData) {
        const mAppts = (monthlyAppts || []).filter(a => {
          const ds = a.start_time.slice(0, 10)
          return ds >= (md._start as string) && ds <= (md._end as string)
        })
        const counts: Record<string, number> = { internal: 0, web: 0, phone: 0, line: 0 }
        for (const a of mAppts) {
          const s = a.booking_source || 'internal'
          counts[s] = (counts[s] || 0) + 1
        }
        Object.assign(md, counts)
        delete md._start
        delete md._end
      }
    }

    return NextResponse.json({
      sourceData,
      total,
      prev: { sourceCounts: prevSourceCounts, total: (prevData || []).length },
      monthlyData,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
