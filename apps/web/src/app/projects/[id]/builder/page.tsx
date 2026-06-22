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
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        style={{
          padding: "0.625rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <Link href={`/projects/${id}`} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          ← {membership.project.name}
        </Link>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BuilderClient projectId={id} />
      </div>
    </main>
  )
}
