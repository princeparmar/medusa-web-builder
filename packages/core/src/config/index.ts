import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export type { PageConfigEntry } from "./pages-config"
export {
  parsePagesConfigFile,
  expandPagesConfigForBuilder,
  buildPagesConfigFromBuilder,
  enrichPagesConfigWithSegmentDefaults,
  segmentPackageName,
  readPagesConfigFileFromRepo,
  writePagesConfigFileToRepo,
  type PagesConfigFile,
  type SegmentRef,
} from "./pages-config"

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
