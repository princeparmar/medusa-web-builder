import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@mwb/db"
import { hasPermission } from "@mwb/core/rbac"
import type { ProjectRole } from "@mwb/db"
import TeamClient from "./TeamClient"

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: session.user.id } },
    include: { project: true },
  })
  if (!membership) notFound()

  return (
    <TeamClient
      projectId={id}
      projectName={membership.project.name}
      canInvite={hasPermission(membership.role as ProjectRole, "project:invite")}
    />
  )
}
