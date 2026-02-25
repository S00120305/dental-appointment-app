import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type StaffMember = {
  id: string
  name: string
  color?: string | null
}

export function useStaff() {
  const { data, error, isLoading, mutate } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  })

  const staffList: StaffMember[] = data?.users || []

  // users.color から staffColors マップを算出
  const staffColors: Record<string, string> = {}
  for (const s of staffList) {
    if (s.color) {
      staffColors[s.id] = s.color
    }
  }

  return {
    staffList,
    staffColors,
    isLoading,
    error,
    mutate,
  }
}
