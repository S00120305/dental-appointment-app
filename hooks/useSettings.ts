import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type SettingsMap = {
  unit_count?: string
  business_hours?: string
  staff_colors?: string
  appointment_types?: string
  reminder_time?: string
  reminder_sms_template?: string
  reminder_email_template?: string
  [key: string]: string | undefined
}

export type BusinessHours = {
  start: string
  end: string
  lunch_start: string
  lunch_end: string
}

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR('/api/settings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const settings: SettingsMap = data?.settings || {}

  const unitCount = settings.unit_count ? parseInt(settings.unit_count) : 5

  let businessHours: BusinessHours = {
    start: '09:00', end: '18:00', lunch_start: '12:30', lunch_end: '14:00',
  }
  if (settings.business_hours) {
    try {
      const bh = JSON.parse(settings.business_hours)
      businessHours = {
        start: bh.start || '09:00',
        end: bh.end || '18:00',
        lunch_start: bh.lunch_start || '12:30',
        lunch_end: bh.lunch_end || '14:00',
      }
    } catch { /* ignore */ }
  }

  let staffColors: Record<string, string> = {}
  if (settings.staff_colors) {
    try { staffColors = JSON.parse(settings.staff_colors) } catch { /* ignore */ }
  }

  return {
    settings,
    unitCount,
    businessHours,
    staffColors,
    isLoading,
    error,
    mutate,
  }
}
