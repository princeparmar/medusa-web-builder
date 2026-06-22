import type { NextAuthConfig } from "next-auth"

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
      const protectedPaths = ["/dashboard", "/onboarding", "/projects"]
      const isProtected = protectedPaths.some((p) => nextUrl.pathname.startsWith(p))
      if (isProtected) return isLoggedIn
      return true
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.onboardingStep = (user as { onboardingStep?: string }).onboardingStep
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
      }
      return session
    },
  },
} satisfies NextAuthConfig
