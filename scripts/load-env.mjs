import { existsSync, readFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

export function loadRootEnv(startDir = process.cwd()) {
  let dir = startDir
  for (let i = 0; i < 6; i++) {
    const envPath = join(dir, ".env")
    if (existsSync(envPath)) {
      applyEnvFile(envPath)
      const localPath = join(dir, ".env.local")
      if (existsSync(localPath)) applyEnvFile(localPath)
      if (process.env.WORKSPACE_ROOT && !process.env.WORKSPACE_ROOT.startsWith("/")) {
        process.env.WORKSPACE_ROOT = join(dir, process.env.WORKSPACE_ROOT)
      }
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function applyEnvFile(path) {
  const content = readFileSync(path, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function getMonorepoRoot() {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, "..")
}
