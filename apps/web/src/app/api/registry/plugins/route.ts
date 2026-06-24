import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { enrichPluginRecord, PLUGIN_CATEGORY_LABELS } from "@mwb/registry"

export async function GET() {
  const plugins = await prisma.pluginRegistry.findMany({
    orderBy: [{ displayName: "asc" }],
  })

  const enriched = plugins.map((p) => enrichPluginRecord(p))

  const grouped = enriched.reduce<Record<string, typeof enriched>>((acc, p) => {
    const key = p.category ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return NextResponse.json({
    plugins: enriched,
    grouped,
    categories: PLUGIN_CATEGORY_LABELS,
    total: enriched.length,
  })
}
