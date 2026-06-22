import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { prisma } from "@mwb/db"
import { ProviderSettingsFileSchema, type BuilderSettings } from "./schemas/index"
import { parseGithubRepoUrl, githubFetch } from "./github-sync"
import {
  PROVIDER_CATALOG,
  MODULE_LABELS,
  type ProviderCatalogEntry,
} from "./providers-catalog"

export type ProviderRegistryRecord = {
  module: string
  providerId: string
  displayName: string
  description: string
  requiresPlugin?: string | null
  medusaResolve?: string | null
  settings: import("./schemas").BuilderSettings
  isBuiltin: boolean
}

async function fetchGithubProviderSettings(
  owner: string,
  repo: string,
  packagePath: string,
  branch: string
): Promise<ProviderSettingsEntry[]> {
  try {
    const data = await githubFetch<{ content: string }>(
      `/repos/${owner}/${repo}/contents/${packagePath}/provider.settings.json?ref=${branch}`
    )
    const raw = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"))
    return normalizeProviderSettingsFile(raw)
  } catch {
    return []
  }
}

type ProviderSettingsEntry = {
  version: string
  module: string
  providerId: string
  displayName: string
  description?: string
  requiresPlugin?: string
  medusaResolve?: string
  settings: BuilderSettings
}

function normalizeProviderSettingsFile(
  raw: unknown
): ProviderSettingsEntry[] {
  const parsed = ProviderSettingsFileSchema.parse(raw)
  if ("providers" in parsed) {
    return parsed.providers.map((p) => ({
      version: parsed.version,
      ...p,
    }))
  }
  return [parsed as ProviderSettingsEntry]
}

export async function readProviderSettingsFromDir(
  pkgDir: string
): Promise<ProviderSettingsEntry[]> {
  const path = join(pkgDir, "provider.settings.json")
  if (!existsSync(path)) return []
  const raw = JSON.parse(await readFile(path, "utf8"))
  return normalizeProviderSettingsFile(raw)
}

async function upsertProviderRecord(params: {
  module: string
  providerId: string
  displayName: string
  description?: string | null
  requiresPlugin?: string | null
  medusaResolve?: string | null
  githubRepo?: string | null
  sourcePackage?: string | null
  settings: import("./schemas").BuilderSettings
  isBuiltin: boolean
}) {
  await prisma.providerRegistry.upsert({
    where: {
      module_providerId: { module: params.module, providerId: params.providerId },
    },
    create: {
      module: params.module,
      providerId: params.providerId,
      displayName: params.displayName,
      description: params.description ?? null,
      requiresPlugin: params.requiresPlugin ?? null,
      medusaResolve: params.medusaResolve ?? null,
      githubRepo: params.githubRepo ?? null,
      sourcePackage: params.sourcePackage ?? null,
      settingsSchemaJson: params.settings as object,
      isBuiltin: params.isBuiltin,
    },
    update: {
      displayName: params.displayName,
      description: params.description ?? null,
      requiresPlugin: params.requiresPlugin ?? null,
      medusaResolve: params.medusaResolve ?? null,
      githubRepo: params.githubRepo ?? null,
      sourcePackage: params.sourcePackage ?? null,
      settingsSchemaJson: params.settings as object,
    },
  })
}

/** Seed built-in Medusa core providers (Google, Cashfree, SMTP, S3) from catalog */
export async function syncProvidersCatalogToDb(): Promise<number> {
  let count = 0
  for (const entry of PROVIDER_CATALOG) {
    await upsertProviderRecord({
      module: entry.module,
      providerId: entry.providerId,
      displayName: entry.displayName,
      description: entry.description,
      requiresPlugin: entry.requiresPlugin ?? null,
      medusaResolve: null,
      githubRepo: null,
      sourcePackage: null,
      settings: entry.settings,
      isBuiltin: true,
    })
    count++
  }
  return count
}

export async function syncProviderFromPackageDir(params: {
  pkgDir: string
  packageName: string
  githubRepo: string
  isBuiltin?: boolean
}): Promise<number> {
  const files = await readProviderSettingsFromDir(params.pkgDir)
  let count = 0
  for (const file of files) {
    await upsertProviderRecord({
      module: file.module,
      providerId: file.providerId,
      displayName: file.displayName,
      description: file.description ?? null,
      requiresPlugin: file.requiresPlugin ?? params.packageName,
      medusaResolve: file.medusaResolve ?? file.requiresPlugin ?? params.packageName,
      githubRepo: params.githubRepo,
      sourcePackage: params.packageName,
      settings: file.settings,
      isBuiltin: params.isBuiltin ?? true,
    })
    count++
  }
  return count
}

export async function syncProviderFromGithubPackage(params: {
  owner: string
  repo: string
  packagePath: string
  branch: string
  packageName: string
  githubRepo: string
  isBuiltin?: boolean
}): Promise<number> {
  const files = await fetchGithubProviderSettings(
    params.owner,
    params.repo,
    params.packagePath,
    params.branch
  )
  let count = 0
  for (const file of files) {
    await upsertProviderRecord({
      module: file.module,
      providerId: file.providerId,
      displayName: file.displayName,
      description: file.description ?? null,
      requiresPlugin: file.requiresPlugin ?? params.packageName,
      medusaResolve: file.medusaResolve ?? file.requiresPlugin ?? params.packageName,
      githubRepo: params.githubRepo,
      sourcePackage: params.packageName,
      settings: file.settings,
      isBuiltin: params.isBuiltin ?? true,
    })
    count++
  }
  return count
}

export async function listProvidersFromDb(): Promise<ProviderRegistryRecord[]> {
  const rows = await prisma.providerRegistry.findMany({ orderBy: [{ module: "asc" }, { displayName: "asc" }] })
  return rows.map((row) => ({
    module: row.module,
    providerId: row.providerId,
    displayName: row.displayName,
    description: row.description ?? "",
    requiresPlugin: row.requiresPlugin,
    medusaResolve: row.medusaResolve,
    settings: row.settingsSchemaJson as import("./schemas").BuilderSettings,
    isBuiltin: row.isBuiltin,
  }))
}

export async function getProviderFromDb(
  module: string,
  providerId: string
): Promise<ProviderRegistryRecord | undefined> {
  const row = await prisma.providerRegistry.findUnique({
    where: { module_providerId: { module, providerId } },
  })
  if (!row) return undefined
  return {
    module: row.module,
    providerId: row.providerId,
    displayName: row.displayName,
    description: row.description ?? "",
    requiresPlugin: row.requiresPlugin,
    medusaResolve: row.medusaResolve,
    settings: row.settingsSchemaJson as import("./schemas").BuilderSettings,
    isBuiltin: row.isBuiltin,
  }
}

export async function getProviderById(providerId: string): Promise<ProviderRegistryRecord | undefined> {
  const row = await prisma.providerRegistry.findFirst({ where: { providerId } })
  if (!row) return undefined
  return getProviderFromDb(row.module, row.providerId)
}

export function catalogProviderEntry(module: string, providerId: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.module === module && p.providerId === providerId)
}

export { MODULE_LABELS, PROVIDER_CATALOG }
