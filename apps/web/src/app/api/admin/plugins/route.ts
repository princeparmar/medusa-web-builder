import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import { PLUGIN_CATEGORY_LABELS } from "@mwb/registry"
import { z } from "zod"

const emptySettings = { version: "1", fields: [] }

const createSchema = z.object({
  packageName: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default("0.1.0"),
  medusaResolve: z.string().optional(),
  category: z.string().default("custom"),
  settingsSchemaJson: z.unknown().optional(),
})

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const plugins = await prisma.pluginRegistry.findMany({
    orderBy: { displayName: "asc" },
  })
  return NextResponse.json({ plugins, categories: PLUGIN_CATEGORY_LABELS })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = createSchema.parse(await request.json())
  let settingsSchemaJson: object | undefined
  if (body.settingsSchemaJson !== undefined) {
    settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }

  const plugin = await prisma.pluginRegistry.create({
    data: {
      packageName: body.packageName,
      displayName: body.displayName,
      description: body.description,
      version: body.version,
      latestVersion: body.version,
      medusaResolve: body.medusaResolve ?? body.packageName,
      category: body.category,
      settingsSchemaJson: settingsSchemaJson ?? emptySettings,
      isBuiltin: false,
    },
  })

  return NextResponse.json(plugin, { status: 201 })
}
