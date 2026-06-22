import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { rateLimitMiddleware } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const limited = rateLimitMiddleware(req as NextRequest)
  if (limited) return limited
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
