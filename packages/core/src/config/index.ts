import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export type PageConfigEntry = {
  route: string
  workflow: string
  layout: string
  segments: string[]
  metadata?: { title?: string; description?: string }
}

export async function readProjectFile<T>(repoPath: string, relativePath: string): Promise<T | null> {
  const fullPath = join(repoPath, relativePath)
  if (!existsSync(fullPath)) return null
  const content = await readFile(fullPath, "utf8")
  return JSON.parse(content) as T
}

export async function writeProjectFile(
  repoPath: string,
  relativePath: string,
  data: unknown
): Promise<void> {
  const fullPath = join(repoPath, relativePath)
  await writeFile(fullPath, JSON.stringify(data, null, 2) + "\n")
}

export async function readPluginsConfig(repoPath: string): Promise<unknown> {
  return readProjectFile(repoPath, "backend/plugins.config.json")
}

export async function writePluginsConfig(repoPath: string, config: unknown): Promise<void> {
  return writeProjectFile(repoPath, "backend/plugins.config.json", config)
}
