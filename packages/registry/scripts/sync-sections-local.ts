import { syncDefaultStorefrontComponents } from "../src/github-sync.ts"
import { prisma } from "@mwb/db"

const path = process.env.STOREFRONT_COMPONENTS_PATH
if (!path) {
  console.error("Set STOREFRONT_COMPONENTS_PATH")
  process.exit(1)
}

const count = await syncDefaultStorefrontComponents()
const sections = await prisma.sectionRegistry.findMany({ orderBy: { packageName: "asc" } })
console.log(`Synced ${count} sections`)
for (const s of sections.slice(0, 5)) {
  const fields = (s.settingsSchemaJson as { fields?: unknown[] })?.fields?.length ?? 0
  console.log(`  ${s.packageName} — ${fields} fields`)
}
if (sections.length > 5) console.log(`  ... and ${sections.length - 5} more`)
await prisma.$disconnect()
