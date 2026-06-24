import { loadRootEnv } from "./load-env.mjs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), ".."))

import { syncBuiltinSections, syncPluginsCatalogToDb } from "@mwb/registry"

async function main() {
  const sections = await syncBuiltinSections()
  const plugins = await syncPluginsCatalogToDb()
  console.log(`Seeded ${sections} sections and ${plugins} plugins`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
