import { NextResponse } from "next/server"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { githubCredentialsConfigured } from "@mwb/core/github"
import { logAudit } from "@mwb/core/audit"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  const configured = githubCredentialsConfigured()

  return NextResponse.json({
    configured,
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

  if (!githubCredentialsConfigured()) {
    return NextResponse.json(
      {
        error: "GitHub App not configured",
        hint: "Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env, install the app on medusa-storefronts, then restart the worker.",
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

  await logAudit({
    userId: session!.user.id,
    projectId: id,
    action: "project.github_provision_queued",
  })

  return NextResponse.json({ jobId: job.id, status: "queued" }, { status: 202 })
}
