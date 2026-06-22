import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { BuilderSettingsSchema, type BuilderSettings } from "./schemas/index"

const PILOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../data/pilot")

const cache = new Map<string, BuilderSettings>()

function slugFromPackageName(packageName: string): string {
  return packageName.split("/").pop() ?? packageName
}

/** Load bundled pilot builder.settings.json for a section or plugin package slug. */
export function loadPilotSettings(packageName: string): BuilderSettings | undefined {
  const slug = slugFromPackageName(packageName)
  if (cache.has(slug)) return cache.get(slug)

  const path = join(PILOT_DIR, `${slug}.builder.settings.json`)
  if (!existsSync(path)) return undefined

  const raw = JSON.parse(readFileSync(path, "utf8"))
  const parsed = BuilderSettingsSchema.parse(raw)
  cache.set(slug, parsed)
  return parsed
}

export function pilotSettingsForPackage(packageName: string): BuilderSettings | undefined {
  return loadPilotSettings(packageName)
}
