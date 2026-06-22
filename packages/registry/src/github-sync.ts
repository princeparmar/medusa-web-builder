import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { prisma } from "@mwb/db"
import { BuilderSettingsSchema } from "./schemas/index"
import {
  SECTION_CATALOG,
  packageToDisplayName,
  type SectionCatalogEntry,
  DEFAULT_STOREFRONT_COMPONENTS_REPO,
} from "./catalog"
import { pilotSettingsForPackage } from "./pilot-settings"

export function parseGithubRepoUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "")
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i)
  if (!match) throw new Error(`Invalid GitHub repo URL: ${url}`)
  return { owner: match[1], repo: match[2] }
}

type GithubContentEntry = { name: string; type: string; path: string }

export async function githubFetch<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "medusa-web-builder",
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`https://api.github.com${path}`, { headers })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

async function fetchGithubBuilderSettings(
  owner: string,
  repo: string,
  packageDir: string,
  branch: string
): Promise<unknown | undefined> {
  try {
    const data = await githubFetch<{ content: string }>(
      `/repos/${owner}/${repo}/contents/packages/${packageDir}/builder.settings.json?ref=${branch}`
    )
    const raw = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"))
    return BuilderSettingsSchema.parse(raw)
  } catch {
    return undefined
  }
}

async function fetchPackageVersion(
  owner: string,
  repo: string,
  packageDir: string,
  branch: string
): Promise<string | null> {
  try {
    const data = await githubFetch<{ content: string }>(
      `/repos/${owner}/${repo}/contents/packages/${packageDir}/package.json?ref=${branch}`
    )
    const json = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"))
    return typeof json.version === "string" ? json.version : null
  } catch {
    return null
  }
}

function catalogEntryForPackage(
  packageName: string,
  githubRepo: string
): SectionCatalogEntry | undefined {
  return SECTION_CATALOG.find((s) => s.packageName === packageName)
}

function inferCategoryFromName(entryName: string): SectionCatalogEntry["category"] {
  if (entryName.startsWith("layout-")) return "layout"
  if (entryName.includes("product-") && !entryName.includes("product-grid")) return "product"
  if (entryName.includes("cart")) return "cart"
  if (entryName.includes("checkout")) return "checkout"
  if (entryName.includes("order")) return "orders"
  if (entryName.includes("login") || entryName.includes("wishlist") || entryName.includes("help"))
    return "account"
  if (entryName.includes("filter") || entryName.includes("grid") || entryName.includes("refinement"))
    return "store"
  if (entryName === "segment-nav" || entryName === "segment-footer") return "global"
  return "custom"
}

export async function syncSectionsFromGithub(
  githubRepo: string,
  branch = "main",
  isBuiltin = false
): Promise<number> {
  const { owner, repo } = parseGithubRepoUrl(githubRepo)
  const contents = await githubFetch<GithubContentEntry[]>(
    `/repos/${owner}/${repo}/contents/packages?ref=${branch}`
  )

  let count = 0
  for (const entry of contents) {
    if (entry.type !== "dir") continue
    if (!entry.name.startsWith("segment-") && !entry.name.startsWith("layout-")) continue

    const packageName = `@pradip1995/${entry.name}`
    const remoteVersion = await fetchPackageVersion(owner, repo, entry.name, branch)
    const catalog = catalogEntryForPackage(packageName, githubRepo)
    const componentType = entry.name.startsWith("layout-") ? "layout" : "segment"
    const version = remoteVersion ?? catalog?.version ?? "0.1.0"
    const githubSettings = await fetchGithubBuilderSettings(owner, repo, entry.name, branch)
    const pilotSettings = pilotSettingsForPackage(packageName)
    const settings =
      githubSettings ?? pilotSettings ?? catalog?.settings ?? { version: "1", fields: [] }

    await prisma.sectionRegistry.upsert({
      where: { packageName },
      create: {
        packageName,
        displayName: catalog?.displayName ?? packageToDisplayName(packageName),
        githubRepo,
        version,
        latestVersion: version,
        componentType,
        category: catalog?.category ?? inferCategoryFromName(entry.name),
        description: catalog?.description ?? `${componentType} from ${githubRepo}`,
        manifestJson: (catalog?.manifest ?? {
          id: entry.name.replace(/^(segment|layout)-/, ""),
          type: componentType,
          version,
        }) as object,
        settingsSchemaJson: settings as object,
        pageTypes: catalog?.pageTypes ?? [],
        isBuiltin,
      },
      update: {
        displayName: catalog?.displayName ?? packageToDisplayName(packageName),
        githubRepo,
        latestVersion: version,
        componentType,
        category: catalog?.category ?? inferCategoryFromName(entry.name),
        description: catalog?.description ?? `${componentType} from ${githubRepo}`,
        settingsSchemaJson: settings as object,
        pageTypes: catalog?.pageTypes ?? undefined,
      },
    })
    count++
  }

  return count
}

export async function refreshLatestVersionsFromGithub(): Promise<number> {
  const sections = await prisma.sectionRegistry.findMany({
    where: { githubRepo: { not: null } },
  })

  let updated = 0
  for (const section of sections) {
    if (!section.githubRepo) continue
    const entryName = section.packageName.split("/").pop()
    if (!entryName) continue

    try {
      const { owner, repo } = parseGithubRepoUrl(section.githubRepo)
      const latest = await fetchPackageVersion(owner, repo, entryName, "main")
      if (latest && latest !== section.latestVersion) {
        await prisma.sectionRegistry.update({
          where: { id: section.id },
          data: { latestVersion: latest },
        })
        updated++
      }
    } catch {
      // skip unreachable packages
    }
  }
  return updated
}

export async function registerCustomGithubRepo(githubRepo: string, branch = "main"): Promise<number> {
  await prisma.sectionSource.upsert({
    where: { githubRepo },
    create: { githubRepo, branch, displayName: githubRepo.split("/").pop() ?? githubRepo },
    update: { branch },
  })

  return syncSectionsFromGithub(githubRepo, branch, false)
}

export async function syncDefaultStorefrontComponents(): Promise<number> {
  const repo =
    process.env.STOREFRONT_COMPONENTS_GITHUB ?? DEFAULT_STOREFRONT_COMPONENTS_REPO
  const path = process.env.STOREFRONT_COMPONENTS_PATH

  if (path && existsSync(path)) {
    return syncSectionsFromLocalPath(path, repo)
  }

  try {
    return await syncSectionsFromGithub(repo, "main", true)
  } catch (err) {
    console.warn("GitHub section sync failed, using built-in catalog:", err)
    return syncCatalogToDb()
  }
}

async function syncSectionsFromLocalPath(componentsPath: string, githubRepo: string): Promise<number> {
  const packagesDir = join(componentsPath, "packages")
  const { readdir, stat } = await import("fs/promises")
  const entries = await readdir(packagesDir)
  let count = 0

  for (const entry of entries) {
    if (!entry.startsWith("segment-") && !entry.startsWith("layout-")) continue
    const pkgDir = join(packagesDir, entry)
    if (!(await stat(pkgDir)).isDirectory()) continue

    const packageName = `@pradip1995/${entry}`
    const catalog = catalogEntryForPackage(packageName, githubRepo)
    let version = catalog?.version ?? "0.1.0"

    const pkgJsonPath = join(pkgDir, "package.json")
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8"))
      if (pkg.version) version = pkg.version
    }

    let settings: unknown = catalog?.settings
    const settingsPath = join(pkgDir, "builder.settings.json")
    if (existsSync(settingsPath)) {
      settings = BuilderSettingsSchema.parse(JSON.parse(await readFile(settingsPath, "utf8")))
    }

    const componentType = entry.startsWith("layout-") ? "layout" : "segment"

    await prisma.sectionRegistry.upsert({
      where: { packageName },
      create: {
        packageName,
        displayName: catalog?.displayName ?? packageToDisplayName(packageName),
        githubRepo,
        version,
        latestVersion: version,
        componentType,
        category: catalog?.category ?? inferCategoryFromName(entry),
        description: catalog?.description ?? `${componentType} component`,
        manifestJson: (catalog?.manifest ?? {
          id: entry.replace(/^(segment|layout)-/, ""),
          type: componentType,
          version,
        }) as object,
        settingsSchemaJson: settings ?? undefined,
        pageTypes: catalog?.pageTypes ?? [],
        isBuiltin: true,
      },
      update: {
        version,
        latestVersion: version,
        settingsSchemaJson: settings ?? undefined,
      },
    })
    count++
  }
  return count
}

export async function syncCatalogToDb(): Promise<number> {
  let count = 0
  for (const section of SECTION_CATALOG) {
    await prisma.sectionRegistry.upsert({
      where: { packageName: section.packageName },
      create: {
        packageName: section.packageName,
        displayName: section.displayName,
        githubRepo: section.githubRepo ?? DEFAULT_STOREFRONT_COMPONENTS_REPO,
        version: section.version,
        latestVersion: section.latestVersion ?? section.version,
        componentType: section.componentType,
        category: section.category,
        description: section.description,
        manifestJson: (section.manifest ?? {}) as object,
        settingsSchemaJson: section.settings ?? undefined,
        pageTypes: section.pageTypes,
        isBuiltin: true,
      },
      update: {
        displayName: section.displayName,
        githubRepo: section.githubRepo ?? DEFAULT_STOREFRONT_COMPONENTS_REPO,
        latestVersion: section.latestVersion ?? section.version,
        componentType: section.componentType,
        category: section.category,
        description: section.description,
        manifestJson: (section.manifest ?? {}) as object,
        settingsSchemaJson: section.settings ?? undefined,
        pageTypes: section.pageTypes,
      },
    })
    count++
  }
  return count
}
