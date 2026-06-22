import { auth } from "@/auth"
import { prisma } from "@mwb/db"
import { hasPermission, type Permission } from "@mwb/core/rbac"
import type { ProjectRole } from "@mwb/db"
import { NextResponse } from "next/server"

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null }
  }
  return { error: null, session }
}

export async function getProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: true },
  })
}

export async function requireProjectAccess(
  projectId: string,
  permission: Permission
) {
  const { error, session } = await requireAuth()
  if (error) return { error, membership: null, session: null }

  const membership = await getProjectMembership(projectId, session!.user.id)
  if (!membership) {
    return {
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      membership: null,
      session,
    }
  }

  if (!hasPermission(membership.role as ProjectRole, permission)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      membership: null,
      session,
    }
  }

  return { error: null, membership, session }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}
