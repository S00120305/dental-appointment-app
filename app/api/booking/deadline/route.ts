import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// GET: 変更・キャンセル期限設定を取得（公開API）
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

    const { data } = await supabase
      .from('appointment_settings')
      .select('key, value')
      .in('key', ['web_cancel_deadline_time', 'clinic_phone'])

    let deadlineTime = '18:00'
    let clinicPhone = ''
    if (data) {
      for (const row of data) {
        if (row.key === 'web_cancel_deadline_time') deadlineTime = row.value
        if (row.key === 'clinic_phone') clinicPhone = row.value
      }
    }

    return NextResponse.json({
      deadline_time: deadlineTime,
      description: `前日${deadlineTime}まで`,
      clinic_phone: clinicPhone,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
