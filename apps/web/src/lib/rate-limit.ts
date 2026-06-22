import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const rateLimit = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 120

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for") ?? "local"
  const now = Date.now()
  const entry = rateLimit.get(ip)

  if (!entry || entry.reset < now) {
    rateLimit.set(ip, { count: 1, reset: now + WINDOW_MS })
    return null
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  return null
}
