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
