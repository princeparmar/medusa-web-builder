import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { sendInviteEmail } from "@mwb/core/email"
import { logAudit } from "@mwb/core/audit"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "DEVELOPER", "VIEWER"]),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const invites = await prisma.projectInvite.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(invites)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, session, membership } = await requireProjectAccess(id, "project:invite")
  if (error) return error

  try {
    const body = await request.json()
    const data = schema.parse(body)

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) {
      const existingMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: existingUser.id } },
      })
      if (existingMember) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 })
      }
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const invite = await prisma.projectInvite.upsert({
      where: { projectId_email: { projectId: id, email: data.email } },
      create: {
        projectId: id,
        email: data.email,
        role: data.role,
        invitedById: session!.user.id,
        expiresAt,
      },
      update: {
        role: data.role,
        status: "PENDING",
        expiresAt,
        invitedById: session!.user.id,
      },
    })

    await sendInviteEmail(data.email, membership!.project.name, invite.token, data.role)
    await logAudit({
      userId: session!.user.id,
      projectId: id,
      action: "project.invite",
      metadata: { email: data.email, role: data.role },
    })

    return NextResponse.json(invite, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invite failed" }, { status: 500 })
  }
}
