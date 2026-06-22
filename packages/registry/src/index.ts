import { prisma } from "@mwb/db"
import { SECTION_CATALOG } from "./catalog"
import {
  syncCatalogToDb,
  syncDefaultStorefrontComponents,
  registerCustomGithubRepo,
  refreshLatestVersionsFromGithub,
} from "./github-sync"
import { compareVersions, hasUpdateAvailable } from "./version"
import { BuilderSettingsSchema } from "./schemas/index"
import { PLUGIN_CATALOG, PLUGIN_CATEGORY_LABELS } from "./plugins-catalog"
import { syncDefaultPlugins, syncPluginsCatalogToDb, syncPluginsFromPath, enrichPluginRecord, registerCustomPluginGithubRepo, syncPluginsFromGithub } from "./plugins-sync"

export async function syncBuiltinSections(): Promise<number> {
  return syncCatalogToDb()
}

export async function syncBuiltinPlugins(): Promise<number> {
  return syncDefaultPlugins()
}

export async function syncSectionsFromPath(componentsPath: string): Promise<number> {
  const { syncDefaultStorefrontComponents } = await import("./github-sync")
  process.env.STOREFRONT_COMPONENTS_PATH = componentsPath
  return syncDefaultStorefrontComponents()
}

export { registerCustomGithubRepo, syncDefaultStorefrontComponents, refreshLatestVersionsFromGithub }
export { SECTION_CATALOG, PLUGIN_CATALOG, PLUGIN_CATEGORY_LABELS, BuilderSettingsSchema, compareVersions, hasUpdateAvailable }
export { syncPluginsCatalogToDb, syncPluginsFromPath, syncDefaultPlugins, enrichPluginRecord, registerCustomPluginGithubRepo, syncPluginsFromGithub }

export type SectionForPage = {
  packageName: string
  displayName: string
  description: string | null
  componentType: string
  category: string | null
  version: string
  latestVersion: string | null
  installedVersion: string | null
  updateAvailable: boolean
  githubRepo: string | null
  pageTypes: string[]
  settingsSchemaJson?: unknown
  manifestJson?: unknown
  isBuiltin: boolean
}

export function filterSectionsForPage(
  sections: SectionForPage[],
  pageRoute: string,
  options?: { includeLayouts?: boolean; includeGlobal?: boolean }
): SectionForPage[] {
  const includeLayouts = options?.includeLayouts ?? true
  const includeGlobal = options?.includeGlobal ?? true

  return sections.filter((s) => {
    if (s.componentType === "layout") {
      return includeLayouts && (s.pageTypes.length === 0 || s.pageTypes.includes(pageRoute))
    }
    if (s.category === "global") return includeGlobal
    return s.pageTypes.includes(pageRoute)
  })
}

export function groupSectionsByCategory(
  sections: SectionForPage[]
): Record<string, SectionForPage[]> {
  const groups: Record<string, SectionForPage[]> = {}
  for (const s of sections) {
    const key = s.componentType === "layout" ? "layout" : (s.category ?? "other")
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
}
