import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin, parseTags } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import { PLUGIN_CATEGORY_LABELS } from "@mwb/registry"
import {
  assertNpmPackageVersion,
  addCatalogPackageVersion,
  listCatalogPackageVersions,
  listCatalogMedia,
} from "@mwb/registry"
import { z } from "zod"

const emptySettings = { version: "1", fields: [] }

const createSchema = z.object({
  packageName: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1),
  medusaResolve: z.string().optional(),
  category: z.string().default("custom"),
  homepageUrl: z.union([z.string().url(), z.literal("")]).optional(),
  githubRepo: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  settingsSchemaJson: z.unknown().optional(),
})

async function attachCatalogExtras(plugins: Array<{ id: string }>) {
  return Promise.all(
    plugins.map(async (plugin) => {
      const [versions, media] = await Promise.all([
        listCatalogPackageVersions("PLUGIN", plugin.id),
        listCatalogMedia("PLUGIN", plugin.id),
      ])
      return { ...plugin, versions, media }
    })
  )
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const plugins = await prisma.pluginRegistry.findMany({
    orderBy: { displayName: "asc" },
  })
  return NextResponse.json({
    plugins: await attachCatalogExtras(plugins),
    categories: PLUGIN_CATEGORY_LABELS,
  })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = createSchema.parse(await request.json())
  const npmCheck = await assertNpmPackageVersion(body.packageName, body.version)
  if (!npmCheck.ok) {
    return NextResponse.json({ error: npmCheck.error }, { status: 400 })
  }

  let settingsSchemaJson: object | undefined
  if (body.settingsSchemaJson !== undefined) {
    settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }

  const tags = parseTags(body.tags)
  const homepageUrl = body.homepageUrl?.trim() || null
  const githubRepo = body.githubRepo?.trim() || null

  const plugin = await prisma.pluginRegistry.create({
    data: {
      packageName: npmCheck.packageName,
      displayName: body.displayName,
      description: body.description,
      version: npmCheck.version,
      latestVersion: npmCheck.version,
      medusaResolve: body.medusaResolve ?? npmCheck.packageName,
      category: body.category,
      tags,
      homepageUrl,
      githubRepo,
      settingsSchemaJson: settingsSchemaJson ?? emptySettings,
      isBuiltin: false,
    },
  })

  await addCatalogPackageVersion({
    kind: "PLUGIN",
    registryId: plugin.id,
    version: npmCheck.version,
  })

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("PLUGIN", plugin.id),
    listCatalogMedia("PLUGIN", plugin.id),
  ])

  return NextResponse.json({ ...plugin, versions, media }, { status: 201 })
}
