import { auth } from "@/auth"
import { prisma, type AdminRole } from "@mwb/db"
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

/** Load admin role from DB so revoked admins lose access on the next request. */
export async function getAdminUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      adminRole: true,
    },
  })
}

export async function requireAdmin() {
  const { error, session } = await requireAuth()
  if (error) return { error, session: null, admin: null }

  const admin = await getAdminUser(session!.user.id)
  if (!admin?.isAdmin || !admin.adminRole) {
    return {
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      session: null,
      admin: null,
    }
  }

  return { error: null, session, admin }
}

export async function requireSuperAdmin() {
  const result = await requireAdmin()
  if (result.error) return result

  if (result.admin!.adminRole !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json({ error: "Super admin access required" }, { status: 403 }),
      session: null,
      admin: null,
    }
  }

  return result
}

export function isSuperAdmin(role: AdminRole | null | undefined): boolean {
  return role === "SUPER_ADMIN"
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

export function parseTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 32)
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 32)
  }
  return []
}
