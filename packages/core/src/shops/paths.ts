import { join, resolve, dirname } from "path"
import { fileURLToPath } from "url"

const MONOREPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")

/** Root folder for scaffolded shops (default: monorepo `shops/`). */
export function getShopsRoot(): string {
  const root = process.env.WORKSPACE_ROOT ?? "../shops"
  if (root.startsWith("/")) return root
  return resolve(MONOREPO_ROOT, root)
}

export function getShopPath(slug: string): string {
  return join(getShopsRoot(), slug)
}

/** @deprecated Use getShopPath(slug) */
export function getProjectRepoPath(slugOrId: string): string {
  return getShopPath(slugOrId)
}

export function getWorkspaceRoot(): string {
  return getShopsRoot()
}
