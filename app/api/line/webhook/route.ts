import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyLineSignature, replyLineMessage, getLineProfile } from '@/lib/notifications/line'

// POST /api/line/webhook
// LINE からの Webhook イベントを受信する
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature') || ''

    // 署名検証
    if (!verifyLineSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const data = JSON.parse(body)
    const events = data.events || []
    const supabase = createServerClient()

    for (const event of events) {
      const lineUserId = event.source?.userId
      if (!lineUserId) continue

      if (event.type === 'follow') {
        // 友だち追加イベント
        // 1. プロフィール取得
        const profile = await getLineProfile(lineUserId)

        // 2. 既に patients テーブルに紐付いているか確認
        const { data: existing } = await supabase
          .from('patients')
          .select('id')
          .eq('line_user_id', lineUserId)
          .eq('is_active', true)
          .limit(1)

        if (existing && existing.length > 0) {
          // 既に紐付き済み → 歓迎メッセージ
          if (event.replyToken) {
            await replyLineMessage(
              event.replyToken,
              'おーるけあ歯科のLINE通知にご登録いただきありがとうございます。\n予約のリマインドや確認通知をLINEでお送りします。'
            )
          }
          continue
        }

        // 3. line_pending_links に仮保存（upsert）
        await supabase
          .from('line_pending_links')
          .upsert({
            line_user_id: lineUserId,
            line_display_name: profile?.displayName || null,
          }, { onConflict: 'line_user_id' })

        // 4. 歓迎メッセージを返信
        if (event.replyToken) {
          await replyLineMessage(
            event.replyToken,
            'おーるけあ歯科のLINE通知にご登録いただきありがとうございます。\n予約のリマインドや確認通知をLINEでお送りします。\n\n院内にて患者情報との紐付けを行いますので、受付にてお声がけください。'
          )
        }
      } else if (event.type === 'unfollow') {
        // ブロック/友だち解除イベント
        // patients テーブルから line_user_id を削除
        await supabase
          .from('patients')
          .update({ line_user_id: null, preferred_notification: 'email' })
          .eq('line_user_id', lineUserId)

        // line_pending_links からも削除
        await supabase
          .from('line_pending_links')
          .delete()
          .eq('line_user_id', lineUserId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('LINE Webhook エラー:', e)
    return NextResponse.json({ ok: true }) // LINE には常に 200 を返す
  }
}
