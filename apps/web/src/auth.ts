import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@mwb/db"
import type { DefaultSession } from "next-auth"
import { authConfig } from "./auth.config"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      onboardingStep: string
    } & DefaultSession["user"]
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user) return null
        const valid = await compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingStep: user.onboardingStep,
        }
      },
    }),
    ...authConfig.providers,
  ],
})
