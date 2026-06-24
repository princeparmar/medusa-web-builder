import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join, resolve } from "path"
import { existsSync } from "fs"
import { prisma } from "@mwb/db"
import {
  filterSectionsForPage,
  hasUpdateAvailable,
  type SectionForPage,
} from "@mwb/registry"

async function readInstalledVersions(workspacePath: string): Promise<Record<string, string>> {
  const pkgPath = join(resolve(workspacePath), "storefront", "package.json")
  if (!existsSync(pkgPath)) return {}
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return deps as Record<string, string>
  } catch {
    return {}
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const pageType = searchParams.get("pageType")
  const all = searchParams.get("all") === "true"

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project?.workspacePath) {
    return NextResponse.json({ error: "Project not ready" }, { status: 404 })
  }

  const installed = await readInstalledVersions(project.workspacePath)
  const sections = await prisma.sectionRegistry.findMany({ orderBy: { displayName: "asc" } })

  const enriched: SectionForPage[] = sections.map((s) => {
    const installedRaw = installed[s.packageName]?.replace(/^[\^~]/, "") ?? null
    const latest = s.latestVersion ?? s.version
    return {
      packageName: s.packageName,
      displayName: s.displayName,
      description: s.description,
      componentType: s.componentType,
      category: s.category,
      version: s.version,
      latestVersion: latest,
      installedVersion: installedRaw ?? s.version,
      updateAvailable: installedRaw
        ? hasUpdateAvailable(installedRaw, latest)
        : hasUpdateAvailable(s.version, latest),
      githubRepo: s.githubRepo,
      pageTypes: s.pageTypes,
      settingsSchemaJson: s.settingsSchemaJson ?? undefined,
      manifestJson: s.manifestJson,
      isBuiltin: s.isBuiltin,
    }
  })

  const filtered = pageType && !all ? filterSectionsForPage(enriched, pageType) : enriched

  return NextResponse.json({
    sections: filtered,
    allSections: all ? enriched : undefined,
  })
}
