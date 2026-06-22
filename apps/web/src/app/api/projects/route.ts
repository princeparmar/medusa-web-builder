import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAuth, slugify } from "@/lib/auth-helpers"
import { enqueueProjectJob } from "@mwb/core/queue"
import { logAudit } from "@mwb/core/audit"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  preset: z.enum(["full", "minimal"]).default("full"),
})

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session!.user.id },
    include: {
      project: {
        include: {
          drafts: { where: { isActive: true }, take: 1 },
          deployments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      ...m.project,
      role: m.role,
      activeDraft: m.project.drafts[0] ?? null,
      latestDeployment: m.project.deployments[0] ?? null,
    }))
  )
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const data = createSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    let slug = slugify(data.name)
    const existingSlug = await prisma.project.findUnique({ where: { slug } })
    if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`

    const project = await prisma.project.create({
      data: {
        name: data.name,
        slug,
        preset: data.preset,
        status: "SCAFFOLDING",
        members: {
          create: { userId: session!.user.id, role: "OWNER" },
        },
      },
    })

    await enqueueProjectJob(
      "scaffold",
      {
        projectId: project.id,
        preset: data.preset,
        defaultRegion: user.defaultRegion,
      },
      `scaffold-${project.id}`
    )

    await prisma.user.update({
      where: { id: session!.user.id },
      data: { onboardingStep: "PROJECT_CREATED" },
    })

    await logAudit({
      userId: session!.user.id,
      projectId: project.id,
      action: "project.create",
      metadata: { name: data.name, preset: data.preset },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
