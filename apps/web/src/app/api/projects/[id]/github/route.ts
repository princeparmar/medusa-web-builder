import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { getGithubInstallationStatus } from "@mwb/core/github"
import { logAudit } from "@mwb/core/audit"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  const installation = await getGithubInstallationStatus()

  return NextResponse.json({
    configured: installation.configured,
    installed: installation.installed,
    installUrl: installation.installUrl,
    availableInstallations: installation.availableInstallations,
    installationError: installation.error ?? null,
    linked: !!project.githubRepoId,
    githubRepo: project.githubRepo,
    githubRepoId: project.githubRepoId,
    expectedRepo: `medusa-storefronts/storefront-${id}`,
    orgUrl: "https://github.com/orgs/medusa-storefronts/repositories",
    errorMessage: project.errorMessage,
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, session, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const installation = await getGithubInstallationStatus()

  if (!installation.configured) {
    return NextResponse.json(
      {
        error: "GitHub App not configured",
        hint: "Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env, then restart web and worker containers.",
      },
      { status: 503 }
    )
  }

  if (!installation.installed) {
    return NextResponse.json(
      {
        error: installation.error ?? "GitHub App not installed on the target organization",
        hint: `Install the app on org "${installation.org}" from GitHub → Organization settings → GitHub Apps.`,
        installUrl: installation.installUrl,
        availableInstallations: installation.availableInstallations,
      },
      { status: 503 }
    )
  }

  const project = membership!.project
  if (project.status !== "READY") {
    return NextResponse.json({ error: "Project must be READY before linking GitHub" }, { status: 400 })
  }
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Project workspace not found" }, { status: 400 })
  }

  const job = await enqueueProjectJob(
    "github.provision",
    { projectId: id, userId: session!.user.id },
    `github-provision-${id}-${Date.now()}`
  )

  await prisma.project.update({
    where: { id },
    data: { errorMessage: null },
  })

  await logAudit({
    userId: session!.user.id,
    projectId: id,
    action: "project.github_provision_queued",
  })

  return NextResponse.json({ jobId: job.id, status: "queued" }, { status: 202 })
}
