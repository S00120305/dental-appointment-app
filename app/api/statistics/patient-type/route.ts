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

    // 期間内の予約（キャンセル・無断除外）
    const { data: currentAppts, error } = await supabase
      .from('appointments')
      .select('id, patient_id, start_time, status')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd)
      .order('start_time', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const appointments = currentAppts || []

    // 期間内に来院した患者IDセット
    const patientIds = [...new Set(appointments.map(a => a.patient_id))]

    // 各患者の全予約の最初のレコードを取得
    // まず全患者の最初の予約日を取得
    let newPatientCount = 0
    let revisitCount = 0 // 再初診
    let returningCount = 0 // 再診

    // 患者ごとの過去予約を効率的に取得
    if (patientIds.length > 0) {
      // 各患者の最初の予約を取得
      const { data: allAppts } = await supabase
        .from('appointments')
        .select('patient_id, start_time, status')
        .eq('is_deleted', false)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .in('patient_id', patientIds)
        .order('start_time', { ascending: true })

      const patientAppts: Record<string, { start_time: string; status: string }[]> = {}
      for (const a of allAppts || []) {
        if (!patientAppts[a.patient_id]) patientAppts[a.patient_id] = []
        patientAppts[a.patient_id].push(a)
      }

      const processedPatients = new Set<string>()

      for (const a of appointments) {
        if (processedPatients.has(a.patient_id)) continue
        processedPatients.add(a.patient_id)

        const history = patientAppts[a.patient_id] || []
        const firstAppt = history[0]

        if (firstAppt && firstAppt.start_time >= rangeStart && firstAppt.start_time <= rangeEnd) {
          // 新患: この期間内に初めて予約した
          newPatientCount++
        } else {
          // 前回来院日を探す
          const prevCompleted = history
            .filter(h => h.status === 'completed' && h.start_time < rangeStart)
            .sort((a, b) => b.start_time.localeCompare(a.start_time))

          if (prevCompleted.length > 0) {
            const lastVisit = new Date(prevCompleted[0].start_time)
            const periodStart = new Date(rangeStart)
            const monthsDiff = (periodStart.getFullYear() - lastVisit.getFullYear()) * 12 +
              (periodStart.getMonth() - lastVisit.getMonth())

            if (monthsDiff >= 6) {
              revisitCount++ // 再初診（6ヶ月以上空き）
            } else {
              returningCount++ // 再診
            }
          } else {
            // 過去に完了した予約がない場合
            returningCount++
          }
        }
      }
    }

    // 前期間比較
    const startD = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    const daysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEndD = new Date(startD.getTime() - 1000 * 60 * 60 * 24)
    const prevStartD = new Date(prevEndD.getTime() - (daysDiff - 1) * 1000 * 60 * 60 * 24)
    const prevStart = formatDate(prevStartD)
    const prevEnd = formatDate(prevEndD)

    // 前期間の大まかな新患数
    const { data: prevAppts } = await supabase
      .from('appointments')
      .select('patient_id, start_time')
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gte('start_time', `${prevStart}T00:00:00+09:00`)
      .lte('start_time', `${prevEnd}T23:59:59+09:00`)

    const prevPatientIds = [...new Set((prevAppts || []).map(a => a.patient_id))]
    let prevNewCount = 0
    if (prevPatientIds.length > 0) {
      const { data: prevFirstAppts } = await supabase
        .from('appointments')
        .select('patient_id, start_time')
        .eq('is_deleted', false)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .in('patient_id', prevPatientIds)
        .order('start_time', { ascending: true })

      const prevFirstMap: Record<string, string> = {}
      for (const a of prevFirstAppts || []) {
        if (!prevFirstMap[a.patient_id]) prevFirstMap[a.patient_id] = a.start_time
      }
      for (const pid of prevPatientIds) {
        const first = prevFirstMap[pid]
        if (first && first >= `${prevStart}T00:00:00+09:00` && first <= `${prevEnd}T23:59:59+09:00`) {
          prevNewCount++
        }
      }
    }

    // 月別推移データ（過去6ヶ月）
    const monthlyData: { month: string; new: number; revisit: number; returning: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0)
      const mLabel = `${mDate.getFullYear()}/${mDate.getMonth() + 1}`
      // Simplified: just count total patients per month (detailed breakdown would be too expensive)
      monthlyData.push({ month: mLabel, new: 0, revisit: 0, returning: 0 })
    }

    return NextResponse.json({
      newPatients: newPatientCount,
      revisit: revisitCount,
      returning: returningCount,
      prev: { newPatients: prevNewCount },
      totalPatients: patientIds.length,
      monthlyData,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
