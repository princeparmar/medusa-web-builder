import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      drafts: { orderBy: { updatedAt: "desc" } },
      deployments: { orderBy: { createdAt: "desc" }, take: 10 },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      invites: { where: { status: "PENDING" } },
    },
  })

  return NextResponse.json({ ...project, role: membership!.role })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:delete")
  if (error) return error

  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
