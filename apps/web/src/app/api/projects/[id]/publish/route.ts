import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { logAudit } from "@mwb/core/audit"
import { z } from "zod"

const schema = z.object({
  draftId: z.string().uuid(),
  mergeToMain: z.boolean().default(true),
  releaseNotes: z.string().default(""),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, session } = await requireProjectAccess(id, "project:publish")
  if (error) return error

  const body = await request.json()
  const data = schema.parse(body)

  const draft = await prisma.draft.findFirst({
    where: { id: data.draftId, projectId: id },
  })
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  const job = await enqueueProjectJob(
    "publish",
    {
      projectId: id,
      draftId: data.draftId,
      mergeToMain: data.mergeToMain,
      releaseNotes: data.releaseNotes,
      userId: session!.user.id,
    },
    `publish-${id}-${Date.now()}`
  )

  await logAudit({
    userId: session!.user.id,
    projectId: id,
    action: "project.publish_queued",
    metadata: { draftId: data.draftId, mergeToMain: data.mergeToMain },
  })

  return NextResponse.json({ jobId: job.id, status: "queued" })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const deployments = await prisma.deployment.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(deployments)
}
