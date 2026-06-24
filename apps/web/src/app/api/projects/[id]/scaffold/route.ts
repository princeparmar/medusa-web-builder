import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, session, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (project.status !== "ERROR") {
    return NextResponse.json({ error: "Only failed projects can be retried" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  await prisma.project.update({
    where: { id },
    data: { status: "SCAFFOLDING", errorMessage: null },
  })

  await enqueueProjectJob(
    "scaffold",
    {
      projectId: id,
      preset: project.preset as "full" | "minimal",
      defaultRegion: user.defaultRegion,
    },
    `scaffold-retry-${id}-${Date.now()}`
  )

  return NextResponse.json({ status: "queued" })
}
