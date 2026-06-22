import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@mwb/db"
import { ProjectStatusPoller } from "@/components/ProjectStatusPoller"
import { GithubRepoPanel } from "@/components/GithubRepoPanel"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: session.user.id } },
    include: {
      project: {
        include: {
          drafts: { where: { isActive: true }, take: 1 },
        },
      },
    },
  })

  if (!membership) notFound()

  const { project } = membership
  const activeDraft = project.drafts[0]

  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          ← Projects
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginTop: "0.5rem" }}>
          <div>
            <h1>{project.name}</h1>
            <p style={{ color: "var(--muted)" }}>
              {membership.role} · <span className={`badge badge-${project.status.toLowerCase()}`}>{project.status}</span>
            </p>
            <GithubRepoPanel projectId={id} />
          </div>
          {project.status === "READY" && (
            <Link href={`/projects/${id}/builder`} className="btn btn-primary">
              Open builder
            </Link>
          )}
        </div>
      </header>

      {project.status === "SCAFFOLDING" && <ProjectStatusPoller projectId={id} />}
      {project.status === "ERROR" && (
        <div className="alert alert-error">{project.errorMessage ?? "Scaffold failed"}</div>
      )}

      <nav style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
        <Link href={`/projects/${id}`}>Overview</Link>
        <Link href={`/projects/${id}/builder`}>Builder</Link>
        <Link href={`/projects/${id}/team`}>Team</Link>
        <Link href={`/projects/${id}/deployments`}>Deployments</Link>
        <Link href={`/projects/${id}/settings`}>Settings</Link>
      </nav>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Project details</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.5rem", fontSize: "0.875rem" }}>
          <dt style={{ color: "var(--muted)" }}>Preset</dt>
          <dd>{project.preset}</dd>
          <dt style={{ color: "var(--muted)" }}>Active draft</dt>
          <dd>{activeDraft?.name ?? "—"}</dd>
          <dt style={{ color: "var(--muted)" }}>GitHub</dt>
          <dd>
            {project.githubRepoId ? (
              <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noopener noreferrer">
                {project.githubRepo}
              </a>
            ) : (
              <span style={{ color: "var(--muted)" }}>Not linked — use Create GitHub repository above</span>
            )}
          </dd>
          <dt style={{ color: "var(--muted)" }}>Workspace</dt>
          <dd style={{ wordBreak: "break-all" }}>{project.workspacePath ?? "—"}</dd>
        </dl>
      </div>
    </main>
  )
}
