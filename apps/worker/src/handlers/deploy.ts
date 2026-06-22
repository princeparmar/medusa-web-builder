import type { Job } from "bullmq"
import { prisma } from "@mwb/db"
import type { DeployTriggerJob } from "@mwb/core/queue"
import { logAudit } from "@mwb/core/audit"

export async function handleDeploy(job: Job<DeployTriggerJob>) {
  const { projectId, tag, releaseUrl } = job.data
  const webhookUrl = process.env.DEPLOY_WEBHOOK_URL

  await prisma.deployment.updateMany({
    where: { projectId, tag },
    data: { status: "DEPLOYING" },
  })

  if (!webhookUrl) {
    await prisma.deployment.updateMany({
      where: { projectId, tag },
      data: { status: "LIVE", releaseUrl: releaseUrl ?? null },
    })
    await job.log("No DEPLOY_WEBHOOK_URL — marked LIVE")
    return
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const payload = {
    projectId,
    tag,
    releaseUrl,
    githubRepo: project?.githubRepo,
    namespace: `storefront-${projectId}`,
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    await prisma.deployment.updateMany({
      where: { projectId, tag },
      data: { status: "FAILED", errorMessage: errText },
    })
    throw new Error(`Deploy webhook failed: ${errText}`)
  }

  const result = await res.json().catch(() => ({})) as { releaseId?: string }

  await prisma.deployment.updateMany({
    where: { projectId, tag },
    data: {
      status: "LIVE",
      releaseUrl: releaseUrl ?? null,
      k8sReleaseId: result.releaseId ?? null,
    },
  })

  await logAudit({
    projectId,
    action: "deploy.complete",
    metadata: { tag, k8sReleaseId: result.releaseId },
  })
}
