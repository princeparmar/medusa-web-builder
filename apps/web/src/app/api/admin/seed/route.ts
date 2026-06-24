import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { syncBuiltinSections, syncPluginsCatalogToDb } from "@mwb/registry"

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  const [sections, plugins] = await Promise.all([syncBuiltinSections(), syncPluginsCatalogToDb()])

  return NextResponse.json({
    ok: true,
    message: `Imported ${sections} sections and ${plugins} plugins from built-in catalog`,
    sections,
    plugins,
  })
}
