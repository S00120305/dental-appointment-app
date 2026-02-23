import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export type StaffMember = {
  id: string
  name: string
}

export function useStaff() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const staffList: StaffMember[] = data?.users || []

  return {
    staffList,
    isLoading,
    error,
  }
}
