import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { createServerClient } from '@/lib/supabase/server'

// PUT: マスターパスワード変更（管理者のみ）
export async function PUT(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '現在のパスワードと新しいパスワードは必須です' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // 現在のハッシュを取得
    const { data, error: fetchError } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'master_password_hash')
      .single()

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'パスワード設定が見つかりません' },
        { status: 500 }
      )
    }

    // 現在のパスワードを検証
    const isValid = await bcrypt.compare(currentPassword, data.value)
    if (!isValid) {
      return NextResponse.json(
        { error: '現在のパスワードが正しくありません' },
        { status: 401 }
      )
    }

    // 新しいパスワードをハッシュ化して保存
    const newHash = await bcrypt.hash(newPassword, 12)

    const { error: updateError } = await supabase
      .from('clinic_settings')
      .update({
        value: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'master_password_hash')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
