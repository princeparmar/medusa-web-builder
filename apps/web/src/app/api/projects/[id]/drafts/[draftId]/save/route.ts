import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { z } from "zod"

const schema = z.object({
  message: z.string().default("chore: save draft"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const { id, draftId } = await params
  const { error, session } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const draft = await prisma.draft.findFirst({
    where: { id: draftId, projectId: id },
  })
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const data = schema.parse(body)

  const job = await enqueueProjectJob(
    "git.commit",
    {
      projectId: id,
      draftId,
      message: data.message,
      userId: session!.user.id,
    },
    `commit-${id}-${draftId}-${Date.now()}`
  )

  return NextResponse.json({ jobId: job.id, status: "queued" })
}
