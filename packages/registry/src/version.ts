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
  return compareVersions(latest, installed) > 0
}
