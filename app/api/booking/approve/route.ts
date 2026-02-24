import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, recordLog } from '@/lib/log'
import { sendNotification } from '@/lib/notifications'

// PUT: 承認/却下/変更承認（認証必須）
export async function PUT(request: NextRequest) {
  try {
    // 認証確認
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = createServerClient()
    const body = await request.json()

    const {
      appointment_id,
      action,
      reason,
      reject_reason,
      start_time,
      new_start_time,
      unit_number,
      new_unit_number,
    } = body

    // 仕様書互換: reject_reason / new_start_time / new_unit_number も受け付ける
    const effectiveReason = reason || reject_reason
    const effectiveStartTime = start_time || new_start_time
    const effectiveUnitNumber = unit_number || new_unit_number

    if (!appointment_id) {
      return NextResponse.json({ error: '予約IDは必須です' }, { status: 400 })
    }
    if (!action || !['approve', 'reject', 'modify_approve'].includes(action)) {
      return NextResponse.json({ error: 'action は approve / reject / modify_approve のいずれかです' }, { status: 400 })
    }
    if (action === 'modify_approve') {
      if (!effectiveStartTime) {
        return NextResponse.json({ error: '変更承認には start_time が必須です' }, { status: 400 })
      }
      if (!effectiveUnitNumber) {
        return NextResponse.json({ error: '変更承認には unit_number が必須です' }, { status: 400 })
      }
    }

    // 予約取得（pending + is_deleted=false）
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, unit_number, start_time, duration_minutes,
        appointment_type, status, booking_type_id, booking_token, memo,
        patient:patients!patient_id(id, name, phone, email, line_user_id, preferred_notification),
        booking_type:booking_types!left(id, display_name, duration_minutes)
      `)
      .eq('id', appointment_id)
      .eq('is_deleted', false)
      .single()

    if (fetchError || !appointment) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    if (appointment.status !== 'pending') {
      return NextResponse.json({ error: 'この予約は既に処理済みです' }, { status: 400 })
    }

    // 患者情報
    const patient = appointment.patient && !Array.isArray(appointment.patient)
      ? (appointment.patient as { id: string; name: string; phone: string | null; email: string | null; line_user_id: string | null; preferred_notification: string })
      : null

    // booking_type 情報
    const bookingType = appointment.booking_type && !Array.isArray(appointment.booking_type)
      ? (appointment.booking_type as { id: string; display_name: string; duration_minutes: number })
      : null

    // clinic_phone 取得
    const { data: phoneRow } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'clinic_phone')
      .maybeSingle()
    const clinicPhone = phoneRow?.value || ''

    // アクション分岐
    let newStatus: string
    let updateData: Record<string, unknown> = {}

    if (action === 'approve') {
      newStatus = 'scheduled'
      updateData = { status: 'scheduled' }
    } else if (action === 'reject') {
      newStatus = 'cancelled'
      updateData = { status: 'cancelled' }
    } else {
      // modify_approve
      newStatus = 'scheduled'
      updateData = {
        status: 'scheduled',
        start_time: effectiveStartTime,
        unit_number: parseInt(effectiveUnitNumber),
      }
    }

    // DB更新
    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointment_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ログ記録
    const patientName = patient?.name || '不明'
    const actionLabels: Record<string, string> = {
      approve: '承認',
      reject: '却下',
      modify_approve: '変更承認',
    }
    await recordLog({
      userId: user.userId,
      userName: user.userName,
      actionType: `booking_${action}`,
      targetType: 'appointment',
      targetId: appointment_id,
      summary: `${user.userName}が ${patientName} のWeb予約を${actionLabels[action]}`,
      details: {
        action,
        previous_status: 'pending',
        new_status: newStatus,
        ...(effectiveReason ? { reason: effectiveReason } : {}),
        ...(action === 'modify_approve' ? { new_start_time: effectiveStartTime, new_unit_number: effectiveUnitNumber } : {}),
      },
    })

    // 患者に通知送信
    if (patient) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://appo.oralcare-kanazawa.clinic'
        const confirmUrl = appointment.booking_token
          ? `${appUrl}/booking/confirm/${appointment.booking_token}`
          : ''

        const displayName = bookingType?.display_name || appointment.appointment_type
        const durationMinutes = bookingType?.duration_minutes || appointment.duration_minutes

        let message: string
        let emailSubject: string
        let notificationType: string

        const clinicAddress = '〒921-8148 石川県金沢市額新保2-272番地'
        const emailFooter = `\n\n金澤オーラルケアクリニック\n${clinicAddress}${clinicPhone ? `\nTEL: ${clinicPhone}` : ''}`

        if (action === 'approve') {
          const dateFormatted = formatDateJP(appointment.start_time)
          const time = formatTime(appointment.start_time)

          if (patient.preferred_notification === 'line' && patient.line_user_id) {
            message = `🦷 金澤オーラルケアクリニック\n\nご予約が確定しました。\n\n📅 ${dateFormatted} ${time}〜\n📋 ${displayName}（${durationMinutes}分）\n\n▼ 予約の確認\n${confirmUrl}\n\nお会いできることを楽しみにしております。`
          } else {
            message = `${patientName}様\n\nご予約が確定しましたのでお知らせいたします。\n\n■ ご予約内容\n日時: ${dateFormatted} ${time}〜\n内容: ${displayName}（${durationMinutes}分）\n\n■ 予約の確認・変更\n${confirmUrl}\n\n※ 変更・キャンセルは前日18:00まで${emailFooter}`
          }
          emailSubject = '【金澤オーラルケアクリニック】ご予約確定のお知らせ'
          notificationType = 'booking_approved'

        } else if (action === 'reject') {
          const reasonText = effectiveReason ? `\n${effectiveReason}` : ''
          const phoneText = clinicPhone ? `\nTEL: ${clinicPhone}` : ''
          const origDateFormatted = formatDateJP(appointment.start_time)
          const origTime = formatTime(appointment.start_time)

          if (patient.preferred_notification === 'line' && patient.line_user_id) {
            message = `🦷 金澤オーラルケアクリニック\n\nご希望の日時でのご予約が承れませんでした。\n\nご希望日時: ${origDateFormatted} ${origTime}〜${reasonText ? `\n理由: ${reasonText}` : ''}\n\n恐れ入りますが、お電話にてご予約をお願いいたします。${phoneText}`
          } else {
            message = `${patientName}様\n\nご希望の日時でのご予約が承れませんでした。\n\nご希望日時: ${origDateFormatted} ${origTime}〜${reasonText ? `\n理由: ${reasonText}` : ''}\n\n恐れ入りますが、お電話にてご予約をお願いいたします。${phoneText}${emailFooter}`
          }
          emailSubject = '【金澤オーラルケアクリニック】ご予約リクエストについて'
          notificationType = 'booking_rejected'

        } else {
          // modify_approve
          const dateFormatted = formatDateJP(effectiveStartTime)
          const time = formatTime(effectiveStartTime)

          if (patient.preferred_notification === 'line' && patient.line_user_id) {
            message = `🦷 金澤オーラルケアクリニック\n\n日時を変更の上、ご予約を確定しました。\n\n📅 ${dateFormatted} ${time}〜\n📋 ${displayName}（${durationMinutes}分）\n\n▼ 予約の確認\n${confirmUrl}`
          } else {
            message = `${patientName}様\n\n日時を変更の上、ご予約が確定しましたのでお知らせいたします。\n\n■ ご予約内容\n日時: ${dateFormatted} ${time}〜\n内容: ${displayName}（${durationMinutes}分）\n\n■ 予約の確認・変更\n${confirmUrl}\n\n※ 変更・キャンセルは前日18:00まで${emailFooter}`
          }
          emailSubject = '【金澤オーラルケアクリニック】ご予約確定のお知らせ（日時変更）'
          notificationType = 'booking_modified_approved'
        }

        await sendNotification(
          {
            patientId: patient.id,
            email: patient.email,
            lineUserId: patient.line_user_id,
            preferredNotification: (patient.preferred_notification || 'none') as 'line' | 'email' | 'none',
          },
          message,
          notificationType,
          appointment_id,
          emailSubject,
        )
      } catch (e) {
        console.error('承認通知送信失敗:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDateJP(dateOrTime: string): string {
  const d = new Date(dateOrTime)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const jst = new Date(d.getTime() + (9 * 60 - d.getTimezoneOffset()) * 60 * 1000)
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日（${days[jst.getUTCDay()]}）`
}

function formatTime(dateOrTime: string): string {
  const d = new Date(dateOrTime)
  const jst = new Date(d.getTime() + (9 * 60 - d.getTimezoneOffset()) * 60000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}
