import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@mwb/db"
import BuilderClient from "@/components/builder/BuilderClient"

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: session.user.id } },
    include: { project: true },
  })

  if (!membership) notFound()
  if (membership.project.status !== "READY") redirect(`/projects/${id}`)

  return (
    <main className="container" style={{ paddingTop: "1.5rem", paddingBottom: "2rem" }}>
      <header style={{ marginBottom: "1rem" }}>
        <Link href={`/projects/${id}`} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          ← {membership.project.name}
        </Link>
        <h1 style={{ fontSize: "1.25rem", marginTop: "0.25rem" }}>Page builder</h1>
      </header>
      <BuilderClient projectId={id} />
    </main>
  )
}
