import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@mwb/db"
import { SignOutButton } from "@/components/SignOutButton"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (user?.onboardingStep === "REGISTERED") redirect("/onboarding/profile")

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1>Projects</h1>
          <p style={{ color: "var(--muted)" }}>Welcome, {user?.name ?? session.user.email}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/onboarding/project" className="btn btn-primary">
            New project
          </Link>
          <SignOutButton />
        </div>
      </header>

      {memberships.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>No projects yet</p>
          <Link href="/onboarding/project" className="btn btn-primary">
            Create your first project
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {memberships.map(({ project, role }) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h2 style={{ fontSize: "1.125rem" }}>{project.name}</h2>
                <span className={`badge badge-${project.status.toLowerCase()}`}>{project.status}</span>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                {role} · {project.preset}
              </p>
              {project.githubRepo && (
                <p style={{ fontSize: "0.75rem", marginTop: "0.5rem", color: "var(--muted)" }}>
                  {project.githubRepo}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
