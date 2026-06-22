import { syncPluginsFromPath } from "../src/plugins-sync.ts"
import { listProvidersFromDb } from "../src/providers-sync.ts"

const path = process.env.MEDUSA_PLUGINS_PATH
if (!path) {
  console.error("Set MEDUSA_PLUGINS_PATH")
  process.exit(1)
}

const n = await syncPluginsFromPath(path)
const providers = await listProvidersFromDb()
console.log(`Synced ${n} plugins`)
for (const p of providers) {
  console.log(`  ${p.module}/${p.providerId} — ${p.displayName}`)
}
