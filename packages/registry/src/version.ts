/** Compare semver strings; returns 1 if a > b, -1 if a < b, 0 if equal */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

export function hasUpdateAvailable(installed: string, latest: string): boolean {
  return compareVersions(normalizeVersion(latest), normalizeVersion(installed)) > 0
}

export function normalizeVersion(version: string): string {
  return version.replace(/^[\^~>=<]+/, "").trim()
}

/** Pick the highest semver from a list of version strings. */
export function pickMaxVersion(versions: string[]): string {
  const normalized = versions.map(normalizeVersion).filter(Boolean)
  if (normalized.length === 0) return "0.0.0"
  return normalized.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best))
}

export function resolvePluginLatestVersion(
  installed: string,
  registryLatest: string | null | undefined,
  npmLatest: string | null | undefined
): { latest: string; updateAvailable: boolean } {
  const inst = normalizeVersion(installed)
  const candidates = [inst, registryLatest, npmLatest].filter((v): v is string => Boolean(v))
  const latest = pickMaxVersion(candidates)
  const updateAvailable = compareVersions(latest, inst) > 0
  return { latest, updateAvailable }
}
