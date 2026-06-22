import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  getFullRepoName,
  githubCredentialsConfigured,
  listReleaseWorkflowRuns,
  workflowRunToDeploymentStatus,
  type GithubWorkflowRunInfo,
} from "@mwb/core/github"

export type DeploymentListItem = {
  id: string
  tag: string
  status: string
  releaseUrl?: string | null
  releaseNotes?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt?: string
  source: "database" | "github" | "merged"
  workflowRun?: {
    id: number
    status: string
    conclusion: string | null
    htmlUrl: string
    workflowName: string
    event: string
  }
}

function mergeDeployments(
  dbDeployments: Array<{
    id: string
    tag: string
    status: string
    releaseUrl: string | null
    releaseNotes: string | null
    errorMessage: string | null
    createdAt: Date
    updatedAt: Date
  }>,
  workflowRuns: GithubWorkflowRunInfo[]
): DeploymentListItem[] {
  const byTag = new Map<string, DeploymentListItem>()

  for (const d of dbDeployments) {
    byTag.set(d.tag, {
      id: d.id,
      tag: d.tag,
      status: d.status,
      releaseUrl: d.releaseUrl,
      releaseNotes: d.releaseNotes,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      source: "database",
    })
  }

  for (const run of workflowRuns) {
    const existing = byTag.get(run.tag)
    const workflowStatus = workflowRunToDeploymentStatus(run.status, run.conclusion)

    if (existing) {
      byTag.set(run.tag, {
        ...existing,
        source: "merged",
        releaseUrl: existing.releaseUrl ?? run.releaseUrl,
        status:
          existing.status === "LIVE" || existing.status === "FAILED"
            ? existing.status
            : workflowStatus,
        workflowRun: {
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          htmlUrl: run.htmlUrl,
          workflowName: run.workflowName,
          event: run.event,
        },
      })
    } else {
      byTag.set(run.tag, {
        id: `gh-run-${run.id}`,
        tag: run.tag,
        status: workflowStatus,
        releaseUrl: run.releaseUrl,
        releaseNotes: null,
        errorMessage: run.conclusion === "failure" ? "GitHub Actions workflow failed" : null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        source: "github",
        workflowRun: {
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          htmlUrl: run.htmlUrl,
          workflowName: run.workflowName,
          event: run.event,
        },
      })
    }
  }

  return Array.from(byTag.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  const dbDeployments = await prisma.deployment.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  })

  let workflowRuns: GithubWorkflowRunInfo[] = []
  let githubError: string | null = null
  const repoFullName = project.githubRepo ?? getFullRepoName(id)

  if (githubCredentialsConfigured()) {
    try {
      workflowRuns = await listReleaseWorkflowRuns(repoFullName)
    } catch (err) {
      githubError = err instanceof Error ? err.message : "Failed to load GitHub Actions runs"
    }
  }

  const deployments = mergeDeployments(dbDeployments, workflowRuns)

  return NextResponse.json({
    deployments,
    githubRepo: repoFullName,
    githubActionsUrl: `https://github.com/${repoFullName}/actions/workflows/release.yml`,
    githubConfigured: githubCredentialsConfigured(),
    githubError,
  })
}
