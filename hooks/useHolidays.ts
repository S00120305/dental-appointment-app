import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type ClinicHoliday = {
  id: string
  holiday_type: 'weekly' | 'specific' | 'national'
  day_of_week: number | null
  specific_date: string | null
  label: string | null
  is_active: boolean
}

export function useHolidays(year?: number) {
  const y = year || new Date().getFullYear()
  const { data, error, isLoading } = useSWR(
    `/api/clinic-holidays?year=${y}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  )

  const holidays: ClinicHoliday[] = data?.holidays || []

  // 定休曜日セット
  const weeklyClosedDays = new Set<number>()
  for (const h of holidays) {
    if (h.holiday_type === 'weekly' && h.day_of_week !== null) {
      weeklyClosedDays.add(h.day_of_week)
    }
  }

  // 特定日・祝日の休診日マップ (date string → label)
  const holidayDateMap: Record<string, string> = {}
  for (const h of holidays) {
    if ((h.holiday_type === 'specific' || h.holiday_type === 'national') && h.specific_date && h.is_active) {
      holidayDateMap[h.specific_date] = h.label || '休診日'
    }
  }

  // 特定の日付が休診日かどうかをチェック
  function isHoliday(dateStr: string): boolean {
    if (holidayDateMap[dateStr]) return true
    const d = new Date(dateStr + 'T00:00:00')
    return weeklyClosedDays.has(d.getDay())
  }

  // 休診日のラベルを取得
  function getHolidayLabel(dateStr: string): string | null {
    if (holidayDateMap[dateStr]) return holidayDateMap[dateStr]
    const d = new Date(dateStr + 'T00:00:00')
    const DOW = ['日', '月', '火', '水', '木', '金', '土']
    if (weeklyClosedDays.has(d.getDay())) return `${DOW[d.getDay()]}曜定休`
    return null
  }

  return {
    holidays,
    weeklyClosedDays,
    holidayDateMap,
    isHoliday,
    getHolidayLabel,
    isLoading,
    error,
  }
}
