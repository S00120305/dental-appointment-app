import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/notifications/email'
import { sendLineMessage } from '@/lib/notifications/line'

// POST /api/notifications/test
// 通知送信のテスト用エンドポイント
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel, to, message } = body

    if (!channel || !to || !message) {
      return NextResponse.json(
        { error: 'channel, to, message は必須です' },
        { status: 400 }
      )
    }

    let result: { success: boolean; error?: string }

    if (channel === 'line') {
      result = await sendLineMessage(to, message)
    } else if (channel === 'email') {
      result = await sendEmail(to, '【おーるけあ歯科】テスト通知', message)
    } else {
      return NextResponse.json(
        { error: 'channel は line または email を指定してください' },
        { status: 400 }
      )
    }

    return NextResponse.json({ channel, ...result })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
