import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { githubCredentialsConfigured } from "@mwb/core/github"
import {
  listRepoSecrets,
  listRepoVariables,
  createOrUpdateRepoSecret,
  deleteRepoSecret,
  createRepoVariable,
  updateRepoVariable,
  deleteRepoVariable,
} from "@mwb/core/github/actions-config"
import { z } from "zod"

async function requireProjectRepo(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project?.githubRepo) {
    return { error: NextResponse.json({ error: "GitHub repository not linked" }, { status: 400 }) }
  }
  if (!githubCredentialsConfigured()) {
    return {
      error: NextResponse.json({ error: "GitHub App not configured on server" }, { status: 503 }),
    }
  }
  return { project }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const repo = await requireProjectRepo(id)
  if (repo.error) return repo.error

  const [secrets, variables] = await Promise.all([
    listRepoSecrets(repo.project!.githubRepo!),
    listRepoVariables(repo.project!.githubRepo!),
  ])

  return NextResponse.json({ secrets, variables })
}

const secretSchema = z.object({
  type: z.literal("secret"),
  name: z.string().min(1),
  value: z.string().min(1),
})

const variableSchema = z.object({
  type: z.literal("variable"),
  name: z.string().min(1),
  value: z.string(),
})

const deleteSchema = z.object({
  type: z.enum(["secret", "variable"]),
  name: z.string().min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const repo = await requireProjectRepo(id)
  if (repo.error) return repo.error

  const body = z.union([secretSchema, variableSchema]).parse(await request.json())
  const fullName = repo.project!.githubRepo!

  if (body.type === "secret") {
    await createOrUpdateRepoSecret(fullName, body.name, body.value)
  } else {
    await createRepoVariable(fullName, body.name, body.value)
  }

  return NextResponse.json({ ok: true })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const repo = await requireProjectRepo(id)
  if (repo.error) return repo.error

  const body = variableSchema.parse(await request.json())
  await updateRepoVariable(repo.project!.githubRepo!, body.name, body.value)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const repo = await requireProjectRepo(id)
  if (repo.error) return repo.error

  const body = deleteSchema.parse(await request.json())
  const fullName = repo.project!.githubRepo!

  if (body.type === "secret") {
    await deleteRepoSecret(fullName, body.name)
  } else {
    await deleteRepoVariable(fullName, body.name)
  }

  return NextResponse.json({ ok: true })
}
