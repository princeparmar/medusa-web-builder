import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma, type AdminRole } from "@mwb/db"
import { requireSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
})

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const admins = await prisma.user.findMany({
    where: { isAdmin: true, adminRole: { not: null } },
    select: {
      id: true,
      email: true,
      name: true,
      adminRole: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ adminRole: "asc" }, { email: "asc" }],
  })

  return NextResponse.json({ admins })
}

export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = createSchema.parse(await request.json())
  const adminRole = body.role as AdminRole
  const passwordHash = await hash(body.password, 12)

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing?.isAdmin) {
    return NextResponse.json({ error: "This user is already an admin" }, { status: 409 })
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: body.name ?? existing.name ?? "Admin",
          emailVerified: existing.emailVerified ?? new Date(),
          isAdmin: true,
          adminRole,
        },
        select: {
          id: true,
          email: true,
          name: true,
          adminRole: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name ?? "Admin",
          emailVerified: new Date(),
          onboardingStep: "COMPLETE",
          isAdmin: true,
          adminRole,
        },
        select: {
          id: true,
          email: true,
          name: true,
          adminRole: true,
          createdAt: true,
          updatedAt: true,
        },
      })

  return NextResponse.json({ admin: user }, { status: 201 })
}
