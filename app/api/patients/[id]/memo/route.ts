import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'

// PATCH: 患者メモの更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const body = await request.json()

    const { memo } = body

    if (memo === undefined) {
      return NextResponse.json({ error: 'memoは必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('patients')
      .update({ memo: memo ?? '' })
      .eq('id', id)
      .select('id, memo')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ログ記録
    const user = await getSessionUser()
    await recordLog({
      userId: user?.userId,
      userName: user?.userName,
      actionType: 'update',
      targetType: 'patient',
      targetId: id,
      summary: `${user?.userName || '不明'}が 患者メモを更新`,
      details: { memo: memo ? `${String(memo).slice(0, 100)}...` : '' },
    })

    return NextResponse.json({ patient: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
