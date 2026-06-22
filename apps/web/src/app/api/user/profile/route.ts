import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAuth } from "@/lib/auth-helpers"
import { logAudit } from "@mwb/core/audit"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  companyName: z.string().optional(),
  defaultRegion: z.string().length(2).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
})

export async function PUT(request: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const data = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { id: session!.user.id } })
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const name = data.name ?? existing.name
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: session!.user.id },
      data: {
        name,
        companyName: data.companyName,
        defaultRegion: data.defaultRegion ?? "in",
        logoUrl: data.logoUrl || null,
        onboardingStep: "PROFILE_COMPLETE",
      },
    })

    await logAudit({ userId: user.id, action: "user.profile_complete" })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      companyName: user.companyName,
      onboardingStep: user.onboardingStep,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
  return NextResponse.json(user)
}
