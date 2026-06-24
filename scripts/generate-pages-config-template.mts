#!/usr/bin/env tsx
/**
 * Generate pages.config.json with inline segment data from storefront-components builder.settings.json.
 *
 * Usage:
 *   pnpm generate:pages-config-template -- /path/to/storefront-components [input.json] [output.json]
 */
import { readFile, readdir, writeFile } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"
import {
  enrichPagesConfigWithSegmentDefaults,
  parsePagesConfigFile,
} from "../packages/core/src/config/pages-config"
import { FIRST_SETUP_SECTION_OVERRIDES } from "../packages/core/src/scaffold/seed-defaults"
import type { BuilderSettings } from "../packages/core/src/builder-config/types"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const componentsPath = process.argv[2]
if (!componentsPath) {
  console.error("Usage: generate-pages-config-template.mts <storefront-components-path> [input.json] [output.json]")
  console.error("Section schemas are managed in the MWB admin registry; this script is for offline template generation only.")
  process.exit(1)
}
const templateInput =
  process.argv[3] ??
  join(root, "../storefront-framework/packages/create-storefront-app/templates/full/pages.config.json")
const templateOutput = process.argv[4] ?? templateInput

async function loadSectionSchemas(): Promise<
  Array<{ packageName: string; settingsSchema: BuilderSettings | null }>
> {
  const packagesDir = join(componentsPath, "packages")
  if (!existsSync(packagesDir)) {
    throw new Error(`Missing packages dir: ${packagesDir}`)
  }

  const entries = await readdir(packagesDir)
  const sections: Array<{ packageName: string; settingsSchema: BuilderSettings | null }> = []

  for (const dir of entries) {
    const settingsPath = join(packagesDir, dir, "builder.settings.json")
    if (!existsSync(settingsPath)) continue
    const schema = JSON.parse(await readFile(settingsPath, "utf8")) as BuilderSettings
    const packageName = dir.startsWith("@") ? dir : `@pradip1995/${dir}`
    sections.push({ packageName, settingsSchema: schema })
  }

  return sections
}

async function main() {
  const raw = JSON.parse(await readFile(templateInput, "utf8"))
  const file = parsePagesConfigFile(raw)
  const sections = await loadSectionSchemas()

  const enriched = enrichPagesConfigWithSegmentDefaults({
    file,
    sections,
    brand: {},
    overrides: FIRST_SETUP_SECTION_OVERRIDES,
    replaceExisting: true,
  })

  await writeFile(templateOutput, JSON.stringify(enriched, null, 2) + "\n")
  console.log(`Wrote ${templateOutput}`)
  console.log(
    "Segments with inline data:",
    enriched.pages
      .flatMap((p) => p.segments)
      .filter((s) => typeof s === "object")
      .map((s) => (s as { package: string }).package)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ")
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
