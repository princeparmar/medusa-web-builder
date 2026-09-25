import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireSuperAdmin } from "@/lib/auth-helpers"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, admin: actor } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params

  if (id === actor!.id) {
    return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isAdmin: true, adminRole: true },
  })

  if (!target?.isAdmin || !target.adminRole) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 })
  }

  if (target.adminRole === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({
      where: { isAdmin: true, adminRole: "SUPER_ADMIN" },
    })
    if (superAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last super admin" },
        { status: 400 }
      )
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      isAdmin: false,
      adminRole: null,
    },
  })

  return NextResponse.json({ ok: true })
}
