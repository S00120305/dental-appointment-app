import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type StaffHoliday = {
  id: string
  user_id: string
  holiday_date: string
  holiday_type: 'paid_leave' | 'day_off' | 'half_day_am' | 'half_day_pm' | 'other'
  label: string | null
  created_at: string
}

export const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  paid_leave: '有給',
  day_off: '公休',
  half_day_am: '午前休',
  half_day_pm: '午後休',
  other: 'その他',
}

export const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  paid_leave: '#3b82f6',  // blue
  day_off: '#6b7280',     // gray
  half_day_am: '#f59e0b', // amber
  half_day_pm: '#f97316', // orange
  other: '#8b5cf6',       // violet
}

export function useStaffHolidays(year?: number, month?: number) {
  const y = year || new Date().getFullYear()
  const m = month || (new Date().getMonth() + 1)
  const { data, error, isLoading, mutate } = useSWR(
    `/api/staff-holidays?year=${y}&month=${m}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  )

  const staffHolidays: StaffHoliday[] = data?.staff_holidays || []

  // 特定スタッフの特定日が休みかチェック
  function isStaffHoliday(userId: string, dateStr: string): StaffHoliday | null {
    return staffHolidays.find(h => h.user_id === userId && h.holiday_date === dateStr) || null
  }

  // 特定日に休みのスタッフIDセット
  function getHolidayStaffIds(dateStr: string): Set<string> {
    const ids = new Set<string>()
    for (const h of staffHolidays) {
      if (h.holiday_date === dateStr) {
        ids.add(h.user_id)
      }
    }
    return ids
  }

  // 特定日に休みのスタッフの情報マップ
  function getStaffHolidayMap(dateStr: string): Record<string, StaffHoliday> {
    const map: Record<string, StaffHoliday> = {}
    for (const h of staffHolidays) {
      if (h.holiday_date === dateStr) {
        map[h.user_id] = h
      }
    }
    return map
  }

  return {
    staffHolidays,
    isStaffHoliday,
    getHolidayStaffIds,
    getStaffHolidayMap,
    isLoading,
    error,
    mutate,
  }
}
