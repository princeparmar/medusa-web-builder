import { prisma, type CatalogKind } from "@mwb/db"
import { listCatalogMedia, listCatalogPackageVersions } from "@mwb/registry"

export type CatalogPackage = {
  id: string
  kind: CatalogKind
  packageName: string
  displayName: string
  description: string | null
  version: string
  latestVersion: string | null
  homepageUrl: string | null
  githubRepo: string | null
  tags: string[]
  category: string | null
  componentType?: string | null
  media: Array<{
    id: string
    type: "IMAGE" | "VIDEO"
    url: string
    filename: string
  }>
  versions: Array<{ id: string; version: string; notes: string | null }>
}

async function withExtras<T extends { id: string }>(
  kind: CatalogKind,
  row: T
): Promise<T & { media: CatalogPackage["media"]; versions: CatalogPackage["versions"] }> {
  const [media, versions] = await Promise.all([
    listCatalogMedia(kind, row.id),
    listCatalogPackageVersions(kind, row.id),
  ])
  return {
    ...row,
    media: media.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      filename: m.filename,
    })),
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      notes: v.notes,
    })),
  }
}

/** All registered UI components + backend plugins for the public catalog. */
export async function listCatalogPackages(): Promise<CatalogPackage[]> {
  const [sections, plugins] = await Promise.all([
    prisma.sectionRegistry.findMany({ orderBy: { displayName: "asc" } }),
    prisma.pluginRegistry.findMany({ orderBy: { displayName: "asc" } }),
  ])

  const ui = await Promise.all(
    sections.map(async (s) => {
      const extras = await withExtras("SECTION", s)
      return {
        id: s.id,
        kind: "SECTION" as const,
        packageName: s.packageName,
        displayName: s.displayName,
        description: s.description,
        version: s.version,
        latestVersion: s.latestVersion,
        homepageUrl: s.homepageUrl,
        githubRepo: s.githubRepo,
        tags: s.tags ?? [],
        category: s.category,
        componentType: s.componentType,
        media: extras.media,
        versions: extras.versions,
      }
    })
  )

  const backend = await Promise.all(
    plugins.map(async (p) => {
      const extras = await withExtras("PLUGIN", p)
      return {
        id: p.id,
        kind: "PLUGIN" as const,
        packageName: p.packageName,
        displayName: p.displayName,
        description: p.description,
        version: p.version,
        latestVersion: p.latestVersion,
        homepageUrl: p.homepageUrl,
        githubRepo: p.githubRepo,
        tags: p.tags ?? [],
        category: p.category,
        componentType: null,
        media: extras.media,
        versions: extras.versions,
      }
    })
  )

  return [...ui, ...backend].sort((a, b) => a.displayName.localeCompare(b.displayName))
}
