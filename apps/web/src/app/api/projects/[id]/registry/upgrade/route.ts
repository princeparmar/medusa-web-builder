import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import { join, resolve } from "path"
import { existsSync } from "fs"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  packageName: z.string().min(1),
  targetVersion: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const body = schema.parse(await request.json())
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project?.workspacePath) {
    return NextResponse.json({ error: "Project not ready" }, { status: 404 })
  }

  const section = await prisma.sectionRegistry.findUnique({
    where: { packageName: body.packageName },
  })
  if (!section) {
    return NextResponse.json({ error: "Section not found in registry" }, { status: 404 })
  }

  const targetVersion = body.targetVersion ?? section.latestVersion ?? section.version
  const pkgPath = join(resolve(project.workspacePath), "storefront", "package.json")
  if (!existsSync(pkgPath)) {
    return NextResponse.json({ error: "storefront/package.json not found" }, { status: 404 })
  }

  const pkg = JSON.parse(await readFile(pkgPath, "utf8"))
  if (!pkg.dependencies) pkg.dependencies = {}
  pkg.dependencies[body.packageName] = `^${targetVersion}`
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

  return NextResponse.json({
    packageName: body.packageName,
    version: targetVersion,
    message: "Dependency updated in storefront/package.json. Run install on next deploy.",
  })
}
