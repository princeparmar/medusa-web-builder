import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { appUrl } from "@/lib/app-url"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.redirect(appUrl("/login?error=invalid_token", request))
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record || record.expires < new Date()) {
    return NextResponse.redirect(appUrl("/login?error=expired_token", request))
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  })
  await prisma.verificationToken.delete({ where: { token } })

  return NextResponse.redirect(appUrl("/login?verified=1", request))
}
