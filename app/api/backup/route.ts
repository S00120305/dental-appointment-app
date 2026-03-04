import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

// GET: バックアップ履歴の取得（認証必須）
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const { data, error } = await supabase
      .from('backup_requests')
      .select('*, users:requested_by(name)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ backups: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 手動バックアップリクエスト作成（認証必須）
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { userId, backupType = 'full' } = body

    if (!userId) {
      return NextResponse.json({ error: 'userIdは必須です' }, { status: 400 })
    }

    // 既にpending/runningのリクエストがないか確認
    const { data: existing } = await supabase
      .from('backup_requests')
      .select('id, status')
      .in('status', ['pending', 'running'])
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'バックアップが既に実行中です', existingId: existing[0].id },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('backup_requests')
      .insert({
        requested_by: userId,
        request_type: 'manual',
        backup_type: backupType,
        status: 'pending',
        notes: `手動バックアップ (${backupType === 'full' ? 'DB + 画像' : backupType === 'db_only' ? 'DBのみ' : '画像のみ'})`,
      })
      .select()
      .single()

    if (error) {
      console.error('DB error:', error.message); return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ backup: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
