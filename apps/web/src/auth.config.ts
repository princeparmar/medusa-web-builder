import type { NextAuthConfig } from "next-auth"
import type { AdminRole } from "@mwb/db"

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  providers: [],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAdminArea = nextUrl.pathname.startsWith("/admin")
      const isAdminLogin = nextUrl.pathname === "/admin/login"
      if (isAdminArea && !isAdminLogin) return isLoggedIn
      return true
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.onboardingStep = (user as { onboardingStep?: string }).onboardingStep
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false
        token.adminRole = (user as { adminRole?: AdminRole | null }).adminRole ?? null
      }
      if (trigger === "update" && session?.onboardingStep) {
        token.onboardingStep = session.onboardingStep
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.onboardingStep = token.onboardingStep as string
        session.user.isAdmin = Boolean(token.isAdmin)
        session.user.adminRole = (token.adminRole as AdminRole | null) ?? null
      }
      return session
    },
  },
} satisfies NextAuthConfig
