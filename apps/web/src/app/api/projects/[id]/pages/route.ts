import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  readBrandConfig,
  readBuilderState,
} from "@mwb/core/scaffold"
import { writeBuilderArtifacts } from "@mwb/core/builder-config/write"
import { existsSync } from "fs"
import { resolve } from "path"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({ pages: [], brand: {}, sectionProps: {}, sectionsConfig: null })
  }

  const repoPath = resolve(project.workspacePath)
  const { pages, sectionProps } = await readBuilderState(repoPath).catch(() => ({
    pages: [],
    sectionProps: {},
  }))
  const brand = await readBrandConfig(repoPath).catch(() => ({}))

  const { readProjectFile } = await import("@mwb/core/config")
  const sectionsConfig = await readProjectFile(repoPath, "storefront/builder/sections.config.json")

  return NextResponse.json({ pages, brand, sectionProps, sectionsConfig })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Project not ready" }, { status: 400 })
  }

  const body = await request.json()
  const repoPath = resolve(project.workspacePath)

  const existing = await readBuilderState(repoPath).catch(() => ({
    pages: [],
    sectionProps: {} as Record<string, unknown>,
  }))
  const pages = body.pages ?? existing.pages
  const brand = body.brand ?? (await readBrandConfig(repoPath).catch(() => ({})))
  const sectionProps = body.sectionProps ?? existing.sectionProps

  const registry = await prisma.sectionRegistry.findMany()
  const sections = registry.map((s) => {
    const manifest = s.manifestJson as { dataKey?: string } | null
    return {
      packageName: s.packageName,
      dataKey: manifest?.dataKey,
      settingsSchema: (s.settingsSchemaJson ?? null) as import("@mwb/registry/schemas").BuilderSettings | null,
    }
  })

  const compiled = await writeBuilderArtifacts({
    repoPath,
    pages: pages as Array<{ route: string; segments: string[]; workflow?: string; layout?: string }>,
    sectionProps: sectionProps as Record<string, unknown>,
    brand: brand as Record<string, unknown>,
    sections,
  })

  return NextResponse.json({
    ok: true,
    compiled,
    wrote: ["storefront/pages.config.json", "storefront/builder/section-props.json", "storefront/builder/brand.json"],
  })
}
