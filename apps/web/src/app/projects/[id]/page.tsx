import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@mwb/db"
import { ProjectStatusPoller } from "@/components/ProjectStatusPoller"
import { GithubRepoPanel } from "@/components/GithubRepoPanel"
import { ShopSetupWizard } from "@/components/ShopSetupWizard"
import { RetrySetupButton } from "@/components/RetrySetupButton"
import { BuilderAccessLink } from "@/components/BuilderAccessLink"

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ needsLocalDev?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const { needsLocalDev } = await searchParams

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
            <BuilderAccessLink projectId={id} className="btn btn-secondary">
              Section builder
            </BuilderAccessLink>
          )}
        </div>
      </header>

      {project.status === "SCAFFOLDING" && <ProjectStatusPoller projectId={id} />}
      {project.status === "ERROR" && (
        <div className="alert alert-error">
          <p>{project.errorMessage ?? "Shop setup failed"}</p>
          <RetrySetupButton projectId={id} />
        </div>
      )}

      {needsLocalDev === "1" && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          The section builder opens only when the backend and storefront are running locally. Use{" "}
          <strong>Run local</strong> below, wait until both servers are up, then try again.
        </div>
      )}

      <nav style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
        <Link href={`/projects/${id}`}>Setup</Link>
        {project.status === "READY" ? (
          <BuilderAccessLink projectId={id} variant="link">
            Builder
          </BuilderAccessLink>
        ) : (
          <span style={{ color: "var(--muted)" }}>Builder</span>
        )}
        <Link href={`/projects/${id}/settings`}>Plugins</Link>
        <Link href={`/projects/${id}/team`}>Team</Link>
        <Link href={`/projects/${id}/deployments`}>Release history</Link>
      </nav>

      {project.status === "READY" ? (
        <ShopSetupWizard projectId={id} projectName={project.name} shopSlug={project.slug} />
      ) : null}

      <div className="card" style={{ marginTop: project.status === "READY" ? "2rem" : 0 }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Project details</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.5rem", fontSize: "0.875rem" }}>
          <dt style={{ color: "var(--muted)" }}>Preset</dt>
          <dd>{project.preset}</dd>
          <dt style={{ color: "var(--muted)" }}>Current working copy</dt>
          <dd>{activeDraft?.name ?? "—"}</dd>
          <dt style={{ color: "var(--muted)" }}>Cloud backup</dt>
          <dd>
            {project.githubRepoId ? (
              <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noopener noreferrer">
                {project.githubRepo}
              </a>
            ) : (
              <span style={{ color: "var(--muted)" }}>Not linked — set up cloud backup below</span>
            )}
          </dd>
          <dt style={{ color: "var(--muted)" }}>Shop folder</dt>
          <dd style={{ wordBreak: "break-all" }}>{project.workspacePath ?? `shops/${project.slug}`}</dd>
        </dl>
      </div>
    </main>
  )
}
