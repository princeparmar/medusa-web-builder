import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { requireProjectAccess } from "@/lib/auth-helpers"

const execAsync = promisify(exec)

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Shop not ready" }, { status: 400 })
  }

  const storefrontDir = resolve(project.workspacePath, "storefront")
  if (!existsSync(storefrontDir)) {
    return NextResponse.json({ error: "Storefront folder not found" }, { status: 404 })
  }

  try {
    await execAsync("npm run storefront:build", {
      cwd: storefrontDir,
      timeout: 180_000,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Storefront rebuild failed", details: message }, { status: 500 })
  }
}
