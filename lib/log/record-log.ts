import { createServerClient } from '@/lib/supabase/server'

type LogParams = {
  userId?: string | null
  userName?: string | null
  actionType: string
  targetType: string
  targetId?: string | null
  summary: string
  details?: Record<string, unknown>
}

/**
 * appointment_logs にログを記録
 * 失敗時は console.error のみ（APIの成否には影響しない）
 */
export async function recordLog(params: LogParams): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.from('appointment_logs').insert({
      user_id: params.userId || null,
      user_name: params.userName || null,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId || null,
      summary: params.summary,
      details: params.details || {},
    })
  } catch (err) {
    console.error('Failed to record log:', err)
  }
}
