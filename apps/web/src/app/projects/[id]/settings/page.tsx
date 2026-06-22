import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@mwb/db"
import SettingsClient from "./SettingsClient"

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: session.user.id } },
    include: { project: true },
  })
  if (!membership) notFound()

  return <SettingsClient projectId={id} projectName={membership.project.name} />
}
