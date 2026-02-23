import { supabase } from './client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

type AppointmentCallbacks = {
  onInsert?: (payload: ChangePayload) => void
  onUpdate?: (payload: ChangePayload) => void
  onDelete?: (payload: ChangePayload) => void
}

type LabOrderCallbacks = {
  onUpdate?: (payload: ChangePayload) => void
}

type RealtimeCallbacks = {
  appointments?: AppointmentCallbacks
  labOrders?: LabOrderCallbacks
}

export function subscribeToChanges(callbacks: RealtimeCallbacks): RealtimeChannel {
  let channel = supabase.channel('app-realtime')

  // appointments テーブル
  if (callbacks.appointments) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments' },
      (payload: ChangePayload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.appointments?.onInsert?.(payload)
            break
          case 'UPDATE':
            callbacks.appointments?.onUpdate?.(payload)
            break
          case 'DELETE':
            callbacks.appointments?.onDelete?.(payload)
            break
        }
      }
    )
  }

  // lab_orders テーブル（UPDATE のみ — App A からのステータス変更を受信）
  if (callbacks.labOrders) {
    channel = channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'lab_orders' },
      (payload: ChangePayload) => {
        callbacks.labOrders?.onUpdate?.(payload)
      }
    )
  }

  channel.subscribe()
  return channel
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel)
}

// 後方互換（Step 2-1 の既存コードとの互換）
export function subscribeToAppointments(callbacks: AppointmentCallbacks): RealtimeChannel {
  return subscribeToChanges({ appointments: callbacks })
}

export function unsubscribeFromAppointments(channel: RealtimeChannel) {
  unsubscribe(channel)
}
