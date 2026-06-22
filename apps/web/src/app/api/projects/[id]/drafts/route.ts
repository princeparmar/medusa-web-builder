import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1),
  baseBranch: z.string().default("main"),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const drafts = await prisma.draft.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(drafts)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const body = await request.json()
  const data = createSchema.parse(body)
  const draftId = crypto.randomUUID()
  const gitBranch = `draft/${draftId}`

  await prisma.draft.updateMany({
    where: { projectId: id },
    data: { isActive: false },
  })

  const draft = await prisma.draft.create({
    data: {
      id: draftId,
      projectId: id,
      name: data.name,
      gitBranch,
      baseBranch: data.baseBranch,
      isActive: true,
    },
  })

  return NextResponse.json(draft, { status: 201 })
}
