import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@mwb/db"
import { enqueueDeployJob } from "@mwb/core/queue"
import { logAudit } from "@mwb/core/audit"
import {
  extractTagFromWorkflowRun,
  workflowRunToDeploymentStatus,
} from "@mwb/core/github"

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const payload = await request.text()
  const signature = request.headers.get("x-hub-signature-256")

  if (process.env.GITHUB_WEBHOOK_SECRET && !verifySignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const event = request.headers.get("x-github-event")
  const data = JSON.parse(payload)

  if (event === "release" && data.action === "published") {
    const repoFullName = data.repository?.full_name as string
    const tag = data.release?.tag_name as string
    const releaseUrl = data.release?.html_url as string

    const project = await prisma.project.findFirst({
      where: { githubRepo: repoFullName },
    })

    if (project) {
      await prisma.deployment.updateMany({
        where: { projectId: project.id, tag },
        data: { status: "BUILDING", releaseUrl },
      })

      await enqueueDeployJob({
        projectId: project.id,
        tag,
        releaseUrl,
      })

      await logAudit({
        projectId: project.id,
        action: "deploy.webhook_received",
        metadata: { tag, releaseUrl },
      })
    }
  }

  if (event === "workflow_run") {
    const run = data.workflow_run
    const repoFullName = data.repository?.full_name as string
    const workflowPath = run?.path as string | undefined

    if (run && workflowPath === ".github/workflows/release.yml") {
      const tag = extractTagFromWorkflowRun(run)
      const project = await prisma.project.findFirst({
        where: { githubRepo: repoFullName },
      })

      if (project && tag && !tag.startsWith("run-")) {
        const status = workflowRunToDeploymentStatus(run.status, run.conclusion)
        await prisma.deployment.upsert({
          where: { projectId_tag: { projectId: project.id, tag } },
          create: {
            projectId: project.id,
            tag,
            status,
            errorMessage:
              status === "FAILED" ? "GitHub Actions workflow failed" : null,
          },
          update: {
            status,
            errorMessage:
              status === "FAILED" ? "GitHub Actions workflow failed" : null,
          },
        })

        if (status === "LIVE" && run.conclusion === "success") {
          const releaseUrl = `https://github.com/${repoFullName}/releases/tag/${encodeURIComponent(tag)}`
          await prisma.deployment.updateMany({
            where: { projectId: project.id, tag },
            data: { status: "LIVE", releaseUrl },
          })
          await enqueueDeployJob({ projectId: project.id, tag, releaseUrl })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
