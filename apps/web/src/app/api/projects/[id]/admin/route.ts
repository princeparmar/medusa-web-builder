import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { createShopMedusaAdmin, getShopAdminCredentials, getDefaultShopAdminCredentials, getShopLocalStatus } from "@mwb/core/shops"

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
      credentials: getDefaultShopAdminCredentials(project.slug),
      backendLive: false,
    })
  }

  const shopPath = resolve(project.workspacePath)
  const credentials = await getShopAdminCredentials(shopPath, project.slug)
  const local = await getShopLocalStatus(shopPath)
  const backendLive = local.status === "backend_running" || local.status === "running"

  return NextResponse.json({ credentials, backendLive })
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
  const local = await getShopLocalStatus(shopPath)
  const backendLive = local.status === "backend_running" || local.status === "running"
  if (!backendLive) {
    return NextResponse.json({ error: "Start the backend before creating an admin user" }, { status: 400 })
  }

  try {
    const { credentials, output } = await createShopMedusaAdmin(shopPath, project.slug)
    return NextResponse.json({
      ok: true,
      credentials,
      message: "Admin user ready — sign in at the Medusa admin.",
      output: output.trim() || undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
