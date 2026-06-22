import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAuth } from "@/lib/auth-helpers"
import { enqueueRegistryJob } from "@mwb/core/queue"
import { enrichPluginRecord, PLUGIN_CATEGORY_LABELS } from "@mwb/registry"
import { z } from "zod"

export async function GET() {
  const plugins = await prisma.pluginRegistry.findMany({
    orderBy: [{ displayName: "asc" }],
  })

  const sources = await prisma.pluginSource.findMany({ orderBy: { createdAt: "desc" } })
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
    sources,
    total: enriched.length,
    sourceRepo:
      process.env.MEDUSA_PLUGINS_GITHUB ?? "https://github.com/SmartByteLabs/medusa-plugins",
  })
}

const registerSchema = z.object({
  githubRepo: z.string().url(),
  branch: z.string().default("main"),
})

export async function POST(request: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const data = registerSchema.parse(body)

  await enqueueRegistryJob({
    type: "github-plugins-repo",
    githubRepo: data.githubRepo,
    branch: data.branch,
  })

  return NextResponse.json({ status: "queued" }, { status: 202 })
}
