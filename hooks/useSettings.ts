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

/** "1,3,5" → [1,3,5], 旧形式 "4" → [1,2,3,4] にも対応 */
export function parseVisibleUnits(value: string): number[] {
  const trimmed = value.trim()
  // 旧形式: 数値のみ（カンマなし）→ 1〜N の連番を生成
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    if (n >= 1 && n <= 8) {
      return Array.from({ length: n }, (_, i) => i + 1)
    }
  }
  // 新形式: カンマ区切り
  return trimmed
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 8)
    .sort((a, b) => a - b)
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
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  })

  const settings: SettingsMap = data?.settings || {}

  const rawVisible = settings.visible_units || settings.unit_count || '5'
  const parsedUnits = parseVisibleUnits(rawVisible)

  // unit_display_order があればその順序を優先、なければ昇順
  let visibleUnits = parsedUnits
  if (settings.unit_display_order) {
    const orderArr = settings.unit_display_order
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && parsedUnits.includes(n))
    // orderArr に含まれないユニットがあれば末尾に追加
    const remaining = parsedUnits.filter(u => !orderArr.includes(u))
    visibleUnits = [...orderArr, ...remaining]
  }

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
    visibleUnits,
    businessHours,
    staffColors,
    isLoading,
    error,
    mutate,
  }
}
