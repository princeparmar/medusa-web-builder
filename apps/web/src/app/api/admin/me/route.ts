import { prisma } from "@mwb/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"

export async function GET() {
  const { error, session } = await requireAdmin()
  if (error) return error

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, email: true, name: true, isAdmin: true },
  })

  return NextResponse.json({ user })
}
