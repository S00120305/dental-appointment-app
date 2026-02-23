import { supabase } from './client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type AppointmentPayload = RealtimePostgresChangesPayload<Record<string, unknown>>

type RealtimeCallbacks = {
  onInsert?: (payload: AppointmentPayload) => void
  onUpdate?: (payload: AppointmentPayload) => void
  onDelete?: (payload: AppointmentPayload) => void
}

export function subscribeToAppointments(callbacks: RealtimeCallbacks): RealtimeChannel {
  const channel = supabase
    .channel('appointments-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments' },
      (payload: AppointmentPayload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload)
            break
          case 'UPDATE':
            callbacks.onUpdate?.(payload)
            break
          case 'DELETE':
            callbacks.onDelete?.(payload)
            break
        }
      }
    )
    .subscribe()

  return channel
}

export function unsubscribeFromAppointments(channel: RealtimeChannel) {
  supabase.removeChannel(channel)
}
