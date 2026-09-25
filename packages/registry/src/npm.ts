/** Fetch the latest published version from the npm registry. */
export async function fetchNpmLatestVersion(packageName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return typeof data.version === "string" ? data.version : null
  } catch {
    return null
  }
}

export type NpmPackageInfo = {
  name: string
  versions: string[]
  latest: string | null
}

/** Load package metadata from the public npm registry. */
export async function fetchNpmPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/json" },
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    const data = (await res.json()) as {
      name?: string
      versions?: Record<string, unknown>
      "dist-tags"?: { latest?: string }
    }
    const versions = Object.keys(data.versions ?? {})
    return {
      name: data.name ?? packageName,
      versions,
      latest: data["dist-tags"]?.latest ?? null,
    }
  } catch {
    return null
  }
}

export type NpmVersionCheckResult =
  | { ok: true; packageName: string; version: string }
  | { ok: false; error: string }

/** Ensure the package exists on npm and the exact version is published. */
export async function assertNpmPackageVersion(
  packageName: string,
  version: string
): Promise<NpmVersionCheckResult> {
  const trimmedName = packageName.trim()
  const trimmedVersion = version.trim().replace(/^v/, "")

  if (!trimmedName) {
    return { ok: false, error: "Package name is required" }
  }
  if (!trimmedVersion) {
    return { ok: false, error: "Version is required" }
  }

  const info = await fetchNpmPackageInfo(trimmedName)
  if (!info) {
    return {
      ok: false,
      error: `Package "${trimmedName}" was not found on the npm registry`,
    }
  }

  if (!info.versions.includes(trimmedVersion)) {
    return {
      ok: false,
      error: `Version "${trimmedVersion}" of "${trimmedName}" is not published on npm`,
    }
  }

  return { ok: true, packageName: trimmedName, version: trimmedVersion }
}

export async function refreshPluginLatestVersionsFromNpm(): Promise<number> {
  const { prisma } = await import("@mwb/db")
  const { compareVersions } = await import("./version")
  const plugins = await prisma.pluginRegistry.findMany()
  let updated = 0

  for (const plugin of plugins) {
    const npmLatest = await fetchNpmLatestVersion(plugin.packageName)
    if (!npmLatest) continue

    const current = plugin.latestVersion ?? plugin.version
    if (compareVersions(npmLatest, current) >= 0 && npmLatest !== plugin.latestVersion) {
      await prisma.pluginRegistry.update({
        where: { id: plugin.id },
        data: { latestVersion: npmLatest },
      })
      updated++
    }
  }

  return updated
}
