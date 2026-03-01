import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'

// GET: 未紐付けのLINEユーザー一覧
export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('line_pending_links')
      .select('id, line_user_id, line_display_name, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pending_links: data || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: LINEアカウントを患者に紐付け
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { patient_id, line_pending_link_id } = body

    if (!patient_id || !line_pending_link_id) {
      return NextResponse.json({ error: 'patient_id と line_pending_link_id は必須です' }, { status: 400 })
    }

    // pending link を取得
    const { data: link, error: linkError } = await supabase
      .from('line_pending_links')
      .select('line_user_id, line_display_name')
      .eq('id', line_pending_link_id)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: '指定のLINEアカウントが見つかりません' }, { status: 404 })
    }

    // 患者に line_user_id を設定 + preferred_notification を line に
    const { error: updateError } = await supabase
      .from('patients')
      .update({
        line_user_id: link.line_user_id,
        preferred_notification: 'line',
      })
      .eq('id', patient_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // pending link を削除
    await supabase
      .from('line_pending_links')
      .delete()
      .eq('id', line_pending_link_id)

    // ログ記録
    const user = await getSessionUser()
    const { data: patient } = await supabase
      .from('patients')
      .select('last_name, first_name, chart_number')
      .eq('id', patient_id)
      .single()

    const patientName = patient ? `${patient.last_name} ${patient.first_name}`.trim() : '不明'
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'patient',
      targetId: patient_id,
      summary: `${user?.userName || '不明'}が ${patientName}のLINE連携を実行（${link.line_display_name || link.line_user_id}）`,
      details: { line_user_id: link.line_user_id, line_display_name: link.line_display_name },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
