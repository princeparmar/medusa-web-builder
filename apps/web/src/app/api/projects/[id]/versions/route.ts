import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  getCommitHistory,
  listLocalBranches,
  getCurrentBranch,
  pullFromRemote,
  checkoutBranch,
  hasRemoteOrigin,
} from "@mwb/core/git"
import { githubCredentialsConfigured } from "@mwb/core/github"
import { z } from "zod"

function friendlyBranchLabel(gitBranch: string, draftName?: string): string {
  if (draftName) return draftName
  if (gitBranch === "main") return "Live version"
  if (gitBranch.startsWith("draft/")) return "Work in progress"
  return gitBranch
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({
      ready: false,
      commits: [],
      branches: [],
      cloudConnected: githubCredentialsConfigured(),
    })
  }

  const repoPath = resolve(project.workspacePath)
  const drafts = await prisma.draft.findMany({ where: { projectId: id } })
  const draftByBranch = new Map(drafts.map((d) => [d.gitBranch, d]))

  const [commits, branchNames, currentBranch] = await Promise.all([
    getCommitHistory(repoPath).catch(() => []),
    listLocalBranches(repoPath).catch(() => ["main"]),
    getCurrentBranch(repoPath).catch(() => "main"),
  ])

  const branches = branchNames.map((name) => {
    const draft = draftByBranch.get(name)
    return {
      name,
      label: friendlyBranchLabel(name, draft?.name),
      draftId: draft?.id ?? null,
      isActive: draft?.isActive ?? name === currentBranch,
      isLive: name === "main",
    }
  })

  const activeDraft = drafts.find((d) => d.isActive) ?? null
  const remote = await hasRemoteOrigin(repoPath)

  return NextResponse.json({
    ready: true,
    currentBranch,
    activeDraft: activeDraft
      ? { id: activeDraft.id, name: activeDraft.name, gitBranch: activeDraft.gitBranch }
      : null,
    branches,
    commits,
    cloudConnected: githubCredentialsConfigured() && remote,
  })
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("switch-copy"),
    draftId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("pull"),
  }),
])

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
  const repoPath = resolve(project.workspacePath)

  if (body.action === "switch-copy") {
    const draft = await prisma.draft.findFirst({
      where: { id: body.draftId, projectId: id },
    })
    if (!draft) {
      return NextResponse.json({ error: "Working copy not found" }, { status: 404 })
    }

    await checkoutBranch(repoPath, draft.gitBranch)
    await prisma.draft.updateMany({ where: { projectId: id }, data: { isActive: false } })
    await prisma.draft.update({ where: { id: draft.id }, data: { isActive: true } })

    return NextResponse.json({
      ok: true,
      message: `Switched to "${draft.name}"`,
      activeDraft: { id: draft.id, name: draft.name, gitBranch: draft.gitBranch },
    })
  }

  if (body.action === "pull") {
    const draft = await prisma.draft.findFirst({ where: { projectId: id, isActive: true } })
    const branch = draft?.gitBranch ?? (await getCurrentBranch(repoPath))
    const hasRemote = await hasRemoteOrigin(repoPath)
    if (!hasRemote) {
      return NextResponse.json({
        ok: false,
        message: "No cloud backup linked yet — connect cloud storage in project settings first.",
      })
    }
    const summary = await pullFromRemote(repoPath, branch)
    return NextResponse.json({ ok: true, message: summary })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
