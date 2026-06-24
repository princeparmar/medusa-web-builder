import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { runShopSeed, syncAutoStorefrontEnv, readSeedLogs, readSeedRunState } from "@mwb/core/shops"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({ status: "idle", logs: [] })
  }

  const shopPath = resolve(project.workspacePath)
  const url = new URL(request.url)
  const maxLines = Math.min(Number(url.searchParams.get("tail") ?? 300), 500)
  const [state, logs] = await Promise.all([
    readSeedRunState(shopPath),
    readSeedLogs(shopPath, maxLines),
  ])

  return NextResponse.json({ ...state, logs })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({ error: "Shop not ready" }, { status: 400 })
  }

  const shopPath = resolve(project.workspacePath)
  const existing = await readSeedRunState(shopPath)
  if (existing.status === "running") {
    return NextResponse.json({ error: "Seed is already running", status: "running" }, { status: 409 })
  }

  try {
    const output = await runShopSeed(shopPath)
    const { synced: autoValues, missing, publishableKeyStatus } = await syncAutoStorefrontEnv(
      shopPath,
      project.slug
    )
    const state = await readSeedRunState(shopPath)
    const logs = await readSeedLogs(shopPath, 300)
    return NextResponse.json({
      ok: true,
      message: missing.length === 0 ? "Seed complete — publishable key synced." : "Seed finished",
      autoValues,
      missing,
      publishableKeyStatus,
      output: output || undefined,
      ...state,
      logs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const state = await readSeedRunState(shopPath)
    const logs = await readSeedLogs(shopPath, 300)
    return NextResponse.json({ error: message, ...state, logs }, { status: 500 })
  }
}
