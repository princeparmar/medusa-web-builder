import { readFile, readdir, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { prisma } from "@mwb/db"
import { BuilderSettingsSchema } from "./schemas/index"
import { parseGithubRepoUrl, githubFetch } from "./github-sync"
import {
  PLUGIN_CATALOG,
  DEFAULT_MEDUSA_PLUGINS_REPO,
  packageToPluginDisplayName,
  type PluginCatalogEntry,
} from "./plugins-catalog"

type GithubContentEntry = { name: string; type: string; path: string }

type PackageJson = {
  name?: string
  version?: string
  description?: string
}

async function fetchGithubPackageJson(
  owner: string,
  repo: string,
  packagePath: string,
  branch: string
): Promise<PackageJson | null> {
  try {
    const data = await githubFetch<{ content: string }>(
      `/repos/${owner}/${repo}/contents/${packagePath}/package.json?ref=${branch}`
    )
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8")) as PackageJson
  } catch {
    return null
  }
}

async function listGithubPluginPaths(
  owner: string,
  repo: string,
  branch: string
): Promise<string[]> {
  const paths: string[] = []

  for (const container of ["packages", "plugins"]) {
    try {
      const entries = await githubFetch<GithubContentEntry[]>(
        `/repos/${owner}/${repo}/contents/${container}?ref=${branch}`
      )
      for (const entry of entries) {
        if (entry.type === "dir") paths.push(`${container}/${entry.name}`)
      }
    } catch {
      // container not present
    }
  }

  if (paths.length > 0) return paths

  const root = await githubFetch<GithubContentEntry[]>(
    `/repos/${owner}/${repo}/contents?ref=${branch}`
  )
  for (const entry of root) {
    if (entry.type !== "dir" || entry.name.startsWith(".")) continue
    if (["packages", "plugins", "node_modules", "examples", "docs"].includes(entry.name)) continue
    const pkg = await fetchGithubPackageJson(owner, repo, entry.name, branch)
    if (pkg?.name) paths.push(entry.name)
  }

  return paths
}

async function fetchGithubBuilderSettings(
  owner: string,
  repo: string,
  packagePath: string,
  branch: string
): Promise<unknown | undefined> {
  try {
    const data = await githubFetch<{ content: string }>(
      `/repos/${owner}/${repo}/contents/${packagePath}/builder.settings.json?ref=${branch}`
    )
    const raw = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"))
    return BuilderSettingsSchema.parse(raw)
  } catch {
    return undefined
  }
}

async function upsertPluginFromPackage(params: {
  packageName: string
  displayName: string
  description: string
  version: string
  githubRepo: string
  medusaResolve: string
  settings: unknown
  isBuiltin: boolean
}) {
  await prisma.pluginRegistry.upsert({
    where: { packageName: params.packageName },
    create: {
      packageName: params.packageName,
      displayName: params.displayName,
      description: params.description,
      githubRepo: params.githubRepo,
      version: params.version,
      latestVersion: params.version,
      medusaResolve: params.medusaResolve,
      settingsSchemaJson: params.settings as object,
      isBuiltin: params.isBuiltin,
    },
    update: {
      displayName: params.displayName,
      description: params.description,
      githubRepo: params.githubRepo,
      version: params.version,
      latestVersion: params.version,
      medusaResolve: params.medusaResolve,
      settingsSchemaJson: params.settings as object,
    },
  })
}

function catalogEntry(packageName: string): PluginCatalogEntry | undefined {
  return PLUGIN_CATALOG.find((p) => p.packageName === packageName)
}

function inferCategory(packageName: string): string {
  const c = catalogEntry(packageName)
  if (c) return c.category
  if (packageName.includes("payment")) return "payments"
  if (packageName.includes("fulfillment") || packageName.includes("ship")) return "fulfillment"
  if (packageName.includes("auth") || packageName.includes("registration")) return "auth"
  if (packageName.includes("notification")) return "notifications"
  if (packageName.includes("search")) return "search"
  return "admin"
}

export async function syncPluginsCatalogToDb(): Promise<number> {
  let count = 0
  for (const plugin of PLUGIN_CATALOG) {
    await prisma.pluginRegistry.upsert({
      where: { packageName: plugin.packageName },
      create: {
        packageName: plugin.packageName,
        displayName: plugin.displayName,
        description: plugin.description,
        githubRepo: plugin.githubRepo,
        version: plugin.version,
        latestVersion: plugin.latestVersion ?? plugin.version,
        medusaResolve: plugin.medusaResolve,
        settingsSchemaJson: plugin.settings ?? { version: "1", fields: [] },
        isBuiltin: true,
      },
      update: {
        displayName: plugin.displayName,
        description: plugin.description,
        githubRepo: plugin.githubRepo,
        latestVersion: plugin.latestVersion ?? plugin.version,
        medusaResolve: plugin.medusaResolve,
        settingsSchemaJson: plugin.settings ?? undefined,
      },
    })
    count++
  }
  return count
}

export async function syncPluginsFromPath(pluginsPath: string): Promise<number> {
  if (!existsSync(pluginsPath)) {
    return syncPluginsCatalogToDb()
  }

  const entries = await readdir(pluginsPath)
  let count = 0
  const githubRepo = process.env.MEDUSA_PLUGINS_GITHUB ?? DEFAULT_MEDUSA_PLUGINS_REPO

  for (const entry of entries) {
    const pkgDir = join(pluginsPath, entry)
    if (!(await stat(pkgDir)).isDirectory()) continue
    const pkgJsonPath = join(pkgDir, "package.json")
    if (!existsSync(pkgJsonPath)) continue

    const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8"))
    const packageName = pkg.name as string
    if (!packageName) continue

    const catalog = catalogEntry(packageName) ?? catalogEntry(entry)
    const version = (pkg.version as string) ?? catalog?.version ?? "0.0.1"
    const description =
      (pkg.description as string) ?? catalog?.description ?? `${packageName} Medusa plugin`

    let settings: unknown = catalog?.settings ?? { version: "1", fields: [] }
    const settingsPath = join(pkgDir, "builder.settings.json")
    if (existsSync(settingsPath)) {
      settings = BuilderSettingsSchema.parse(JSON.parse(await readFile(settingsPath, "utf8")))
    }

    await prisma.pluginRegistry.upsert({
      where: { packageName },
      create: {
        packageName,
        displayName: catalog?.displayName ?? packageToPluginDisplayName(packageName),
        description,
        githubRepo,
        version,
        latestVersion: version,
        medusaResolve: catalog?.medusaResolve ?? packageName,
        settingsSchemaJson: settings as object,
        isBuiltin: true,
      },
      update: {
        displayName: catalog?.displayName ?? packageToPluginDisplayName(packageName),
        description,
        version,
        latestVersion: version,
        settingsSchemaJson: settings as object,
      },
    })
    count++
  }

  return count
}

export async function syncDefaultPlugins(): Promise<number> {
  const path = process.env.MEDUSA_PLUGINS_PATH
  if (path && existsSync(path)) {
    return syncPluginsFromPath(path)
  }
  return syncPluginsCatalogToDb()
}

export async function syncPluginsFromGithub(
  githubRepo: string,
  branch = "main",
  isBuiltin = false
): Promise<number> {
  const { owner, repo } = parseGithubRepoUrl(githubRepo)
  const packagePaths = await listGithubPluginPaths(owner, repo, branch)
  let count = 0

  for (const packagePath of packagePaths) {
    const pkg = await fetchGithubPackageJson(owner, repo, packagePath, branch)
    if (!pkg?.name) continue

    const catalog = catalogEntry(pkg.name)
    const version = pkg.version ?? catalog?.version ?? "0.0.1"
    const description =
      pkg.description ?? catalog?.description ?? `${pkg.name} Medusa plugin`
    const settings =
      (await fetchGithubBuilderSettings(owner, repo, packagePath, branch)) ??
      catalog?.settings ??
      { version: "1", fields: [] }

    await upsertPluginFromPackage({
      packageName: pkg.name,
      displayName: catalog?.displayName ?? packageToPluginDisplayName(pkg.name),
      description,
      version,
      githubRepo,
      medusaResolve: catalog?.medusaResolve ?? pkg.name,
      settings,
      isBuiltin,
    })
    count++
  }

  return count
}

export async function registerCustomPluginGithubRepo(
  githubRepo: string,
  branch = "main"
): Promise<number> {
  await prisma.pluginSource.upsert({
    where: { githubRepo },
    create: {
      githubRepo,
      branch,
      displayName: githubRepo.split("/").pop() ?? githubRepo,
    },
    update: { branch },
  })

  return syncPluginsFromGithub(githubRepo, branch, false)
}

export function enrichPluginRecord(plugin: {
  packageName: string
  displayName: string
  githubRepo: string
  version: string
  latestVersion: string | null
  description?: string | null
  medusaResolve: string
  settingsSchemaJson: unknown
  isBuiltin: boolean
}) {
  const catalog = catalogEntry(plugin.packageName)
  return {
    ...plugin,
    description: plugin.description ?? catalog?.description ?? null,
    category: plugin.isBuiltin
      ? (catalog?.category ?? inferCategory(plugin.packageName))
      : "custom",
    latestVersion: plugin.latestVersion ?? plugin.version,
    updateAvailable: (plugin.latestVersion ?? plugin.version) !== plugin.version,
  }
}
