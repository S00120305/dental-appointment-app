import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 患者詳細 + 来院統計
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    // 患者基本情報
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, chart_number, last_name, first_name, last_name_kana, first_name_kana, phone, email, birth_date, memo, is_vip, caution_level, is_infection_alert')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: '患者が見つかりません' }, { status: 404 })
    }

    // 来院統計: 全予約を取得してクライアント側で計算
    const { data: allAppointments } = await supabase
      .from('appointments')
      .select('id, status, start_time')
      .eq('patient_id', id)
      .eq('is_deleted', false)

    const appointments = allAppointments || []
    const totalAppointments = appointments.length
    const cancelCount = appointments.filter(a => a.status === 'cancelled').length
    const noShowCount = appointments.filter(a => a.status === 'no_show').length
    const cancelRate = totalAppointments > 0 ? Math.round((cancelCount / totalAppointments) * 1000) / 10 : 0
    const noShowRate = totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 1000) / 10 : 0

    // 最終来院日（completed の最新）
    const completedAppointments = appointments
      .filter(a => a.status === 'completed')
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    const lastVisitDate = completedAppointments.length > 0
      ? new Date(completedAppointments[0].start_time).toISOString().split('T')[0]
      : null

    // 今月の来院数
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthVisits = completedAppointments.filter(a =>
      new Date(a.start_time) >= monthStart
    ).length

    return NextResponse.json({
      patient,
      stats: {
        lastVisitDate,
        thisMonthVisits,
        totalAppointments,
        cancelCount,
        noShowCount,
        cancelRate,
        noShowRate,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
