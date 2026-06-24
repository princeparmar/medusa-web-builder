import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { z } from "zod"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueLocalRunJob, getProjectLocalJobStatus, cancelProjectLocalJobs, getWorkerHealth } from "@mwb/core/queue"
import {
  getShopLocalSnapshot,
  readLocalRunLogs,
  reconcileStuckLocalRun,
  getWorkerLocalRun,
  syncLocalRunWithQueue,
  markLocalRunQueued,
  clearLocalRunLogs,
} from "@mwb/core/shops"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({ status: "stopped", backendPort: 9000, storefrontPort: 8000, logs: [] })
  }

  const shopPath = resolve(project.workspacePath)
  await syncLocalRunWithQueue(id, project.slug, shopPath)
  let snapshot = await getShopLocalSnapshot(shopPath, id, project.slug)
  if (snapshot.workerStatus === "starting" || snapshot.workerStatus === "stopping") {
    await reconcileStuckLocalRun(shopPath, id, project.slug, snapshot.health)
    snapshot = await getShopLocalSnapshot(shopPath, id, project.slug)
  }
  const queueJob = await getProjectLocalJobStatus(id)
  const workerRun = await getWorkerLocalRun(id)
  const worker = await getWorkerHealth()
  const url = new URL(request.url)
  const includeLogs = url.searchParams.get("logs") !== "0"
  const maxLines = Math.min(Number(url.searchParams.get("tail") ?? 200), 500)
  const logs = includeLogs ? await readLocalRunLogs(shopPath, maxLines) : undefined
  const payload = {
    ...snapshot,
    queueJob,
    worker: { online: worker.online, lastSeenMs: worker.lastSeenMs, run: workerRun },
  }
  return NextResponse.json(logs !== undefined ? { ...payload, logs } : payload)
}

const bodySchema = z.object({
  action: z.enum(["start", "start-storefront", "stop"]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Shop not ready" }, { status: 400 })
  }

  const body = bodySchema.parse(await request.json())
  const shopPath = resolve(project.workspacePath)

  if (body.action === "stop") {
    const { markLocalRunStopping, stopShopLocal } = await import("@mwb/core/shops")
    await markLocalRunStopping(id, project.slug, shopPath)
    await cancelProjectLocalJobs(id)
    const state = await stopShopLocal(shopPath, project.slug, id)
    return NextResponse.json({ ok: true, immediate: true, jobId: null, ...state })
  }

  const { job, reused } = await enqueueLocalRunJob(
    body.action,
    { projectId: id, slug: project.slug, action: body.action },
    id
  )

  if (body.action === "start") {
    if (!reused) {
      await clearLocalRunLogs(shopPath)
      await markLocalRunQueued(id, project.slug, shopPath, "backend")
    } else {
      await syncLocalRunWithQueue(id, project.slug, shopPath)
    }
  } else if (body.action === "start-storefront") {
    if (!reused) {
      await markLocalRunQueued(id, project.slug, shopPath, "storefront")
    } else {
      await syncLocalRunWithQueue(id, project.slug, shopPath)
    }
  }

  return NextResponse.json({ ok: true, queued: true, reused, jobId: job.id })
}
