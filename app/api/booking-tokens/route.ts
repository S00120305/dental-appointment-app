import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { sendNotification } from '@/lib/notifications'
import { toPatientDisplayName } from '@/lib/utils/patient-display'

// POST: トークン作成（認証必須）
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = createServerClient()
    const body = await request.json()

    const {
      patient_id,
      booking_type_id,
      duration_minutes,
      staff_id,
      unit_number,
      expires_days = 7,
      memo,
      send_method = 'none',
    } = body

    // バリデーション
    if (!patient_id) return NextResponse.json({ error: '患者IDは必須です' }, { status: 400 })
    if (!booking_type_id) return NextResponse.json({ error: '予約種別は必須です' }, { status: 400 })
    if (!duration_minutes || duration_minutes < 5) {
      return NextResponse.json({ error: '所要時間は5分以上で指定してください' }, { status: 400 })
    }

    // 予約種別の存在確認
    const { data: bookingType, error: typeError } = await supabase
      .from('booking_types')
      .select('id, display_name, is_active, category, is_web_bookable')
      .eq('id', booking_type_id)
      .single()

    if (typeError || !bookingType || !bookingType.is_active) {
      return NextResponse.json({ error: '予約種別が見つかりません' }, { status: 404 })
    }

    // 患者の存在確認
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone, email, line_user_id, preferred_notification')
      .eq('id', patient_id)
      .eq('is_active', true)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: '患者が見つかりません' }, { status: 404 })
    }

    // 有効期限計算
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (expires_days || 7))
    expiresAt.setHours(23, 59, 59, 999)

    // 6桁トークン生成（未使用トークンとの重複チェック）
    let generatedToken = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = Math.floor(100000 + Math.random() * 900000).toString()
      const { data: existing } = await supabase
        .from('booking_tokens')
        .select('id')
        .eq('token', candidate)
        .eq('status', 'unused')
        .maybeSingle()
      if (!existing) {
        generatedToken = candidate
        break
      }
    }
    if (!generatedToken) {
      return NextResponse.json({ error: 'トークンの生成に失敗しました。再度お試しください。' }, { status: 500 })
    }

    // トークン作成
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('booking_tokens')
      .insert({
        patient_id,
        booking_type_id,
        duration_minutes,
        staff_id: staff_id || null,
        unit_number: unit_number || null,
        token: generatedToken,
        memo: memo?.trim() || null,
        status: 'unused',
        expires_at: expiresAt.toISOString(),
        created_by: user.userId,
      })
      .select('id, token')
      .single()

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'トークンの作成に失敗しました' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'
    const tokenUrl = `${appUrl}/booking/token/${tokenRecord.token}`

    // ログ記録
    await recordLog({
      userId: user.userId,
      userName: user.userName,
      actionType: 'create',
      targetType: 'booking_token',
      targetId: tokenRecord.id,
      summary: `${user.userName}が ${patient.name} の次回予約トークンを作成（${bookingType.display_name}）`,
      details: { patient_id, booking_type_id, duration_minutes, staff_id, expires_days, send_method },
    })

    // 通知送信
    let sendResult = null
    if (send_method !== 'none') {
      try {
        const { data: phoneRow } = await supabase
          .from('clinic_settings')
          .select('value')
          .eq('key', 'clinic_phone')
          .maybeSingle()
        const clinicPhone = phoneRow?.value || ''

        const expiresFormatted = formatDateJP(expiresAt)

        let message: string
        const preferredChannel = send_method === 'line' ? 'line' : 'email'

        const patientDisplayName = toPatientDisplayName(bookingType.display_name, bookingType.category, bookingType.is_web_bookable)

        if (preferredChannel === 'line') {
          message = `🦷 金澤オーラルケアクリニック\n\n次回のご予約のご案内です。\n\n📋 ${patientDisplayName}（${duration_minutes}分）\n📆 有効期限: ${expiresFormatted}まで\n\n▼ ご都合のよい日時をお選びください\n${tokenUrl}\n\n※ ご不明な点はお電話ください${clinicPhone ? `\n${clinicPhone}` : ''}`
        } else {
          message = `${patient.name}様\n\n次回のご予約のご案内です。\n下記リンクからご都合のよい日時をお選びください。\n\n■ 予約内容\n内容: ${patientDisplayName}（${duration_minutes}分）\n有効期限: ${expiresFormatted}まで\n\n■ ご予約はこちら\n${tokenUrl}\n\n金澤オーラルケアクリニック\n〒921-8148 石川県金沢市額新保2-272番地${clinicPhone ? `\nTEL: ${clinicPhone}` : ''}`
        }

        sendResult = await sendNotification(
          {
            patientId: patient.id,
            email: patient.email,
            lineUserId: patient.line_user_id,
            preferredNotification: preferredChannel as 'line' | 'email' | 'none',
          },
          message,
          'token_sent',
          undefined,
          '【金澤オーラルケアクリニック】次回ご予約のご案内'
        )
      } catch (e) {
        console.error('トークン通知送信失敗:', e)
      }
    }

    return NextResponse.json({
      success: true,
      token: tokenRecord.token,
      url: tokenUrl,
      notification: sendResult ? { channel: sendResult.channel, success: sendResult.success } : null,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDateJP(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${m}月${d}日`
}
