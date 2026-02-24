// レート制限ユーティリティ（Map方式、サーバーサイド専用）

import { NextRequest } from 'next/server'

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

// staleエントリのGC（5分ごと）
let lastGc = Date.now()
const GC_INTERVAL = 5 * 60 * 1000

function gc() {
  const now = Date.now()
  if (now - lastGc < GC_INTERVAL) return
  lastGc = now
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
  }
}

export function rateLimit(
  ip: string,
  opts: { limit: number; windowMs: number; name?: string }
): RateLimitResult {
  gc()

  const storeName = opts.name || 'default'
  if (!stores.has(storeName)) {
    stores.set(storeName, new Map())
  }
  const store = stores.get(storeName)!

  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, remaining: opts.limit - 1, retryAfterMs: 0 }
  }

  if (entry.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    }
  }

  entry.count++
  return { allowed: true, remaining: opts.limit - entry.count, retryAfterMs: 0 }
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
