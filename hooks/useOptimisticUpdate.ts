'use client'

import { useRef, useCallback } from 'react'

export function useOptimisticUpdate() {
  const pendingIds = useRef<Set<string>>(new Set())

  const isPending = useCallback((id: string): boolean => {
    return pendingIds.current.has(id)
  }, [])

  const execute = useCallback(async <T>(
    id: string,
    optimisticFn: () => void,
    apiFn: () => Promise<T>,
    rollbackFn: () => void,
  ): Promise<T | null> => {
    pendingIds.current.add(id)
    optimisticFn()

    try {
      const result = await apiFn()
      return result
    } catch (error) {
      rollbackFn()
      throw error
    } finally {
      pendingIds.current.delete(id)
    }
  }, [])

  return { execute, isPending }
}
