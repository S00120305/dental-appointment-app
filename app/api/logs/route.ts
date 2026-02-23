import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET: 操作ログ一覧取得（フィルタ + ページネーション）
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const userId = searchParams.get('user_id')
    const targetType = searchParams.get('target_type')
    const limit = parseInt(searchParams.get('limit') || '30')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('appointment_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00+09:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59+09:00`)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (targetType) {
      query = query.eq('target_type', targetType)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: data, total: count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
