import { NextResponse } from "next/server"
import { createQueue, QUEUE_NAMES } from "@mwb/core/queue"
import { requireProjectAccess } from "@/lib/auth-helpers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id, jobId } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const queue = createQueue(QUEUE_NAMES.project)
  const job = await queue.getJob(jobId)

  if (!job) {
    return NextResponse.json({ status: "not_found", state: "not_found" }, { status: 404 })
  }

  const state = await job.getState()
  const failedReason = job.failedReason ?? null
  const progress = job.progress

  return NextResponse.json({
    id: job.id,
    name: job.name,
    state,
    progress,
    failedReason,
    error:
      state === "failed"
        ? failedReason ?? "Repository creation failed"
        : null,
  })
}
