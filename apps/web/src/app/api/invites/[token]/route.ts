import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAuth } from "@/lib/auth-helpers"
import { logAudit } from "@mwb/core/audit"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { id: true, name: true } } },
  })

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite invalid or expired" }, { status: 404 })
  }

  return NextResponse.json(invite)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: true },
  })

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite invalid or expired" }, { status: 404 })
  }

  const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
  if (user?.email !== invite.email) {
    return NextResponse.json({ error: "Invite email does not match your account" }, { status: 403 })
  }

  await prisma.$transaction([
    prisma.projectMember.create({
      data: {
        projectId: invite.projectId,
        userId: session!.user.id,
        role: invite.role,
      },
    }),
    prisma.projectInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
  ])

  await logAudit({
    userId: session!.user.id,
    projectId: invite.projectId,
    action: "project.invite_accept",
  })

  return NextResponse.json({ projectId: invite.projectId })
}
