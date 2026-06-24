import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import { z } from "zod"

const emptySettings = { version: "1", fields: [] }

const createSchema = z.object({
  packageName: z.string().min(3),
  displayName: z.string().min(1),
  version: z.string().default("0.1.0"),
  componentType: z.enum(["segment", "layout"]).default("segment"),
  category: z.string().default("custom"),
  description: z.string().optional(),
  pageTypes: z.array(z.string()).default(["/"]),
  settingsSchemaJson: z.unknown().optional(),
})

function manifestForSection(packageName: string, componentType: string, version: string) {
  const slug = packageName.split("/").pop() ?? packageName
  const id = slug.replace(/^(segment|layout)-/, "")
  const dataKey = id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  return componentType === "layout"
    ? { id, type: "layout", version }
    : { id, type: "segment", version, dataKey }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const sections = await prisma.sectionRegistry.findMany({
    orderBy: [{ componentType: "asc" }, { displayName: "asc" }],
  })
  return NextResponse.json({ sections })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = createSchema.parse(await request.json())
  let settingsSchemaJson: object | undefined
  if (body.settingsSchemaJson !== undefined) {
    settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }

  const section = await prisma.sectionRegistry.create({
    data: {
      packageName: body.packageName,
      displayName: body.displayName,
      version: body.version,
      latestVersion: body.version,
      componentType: body.componentType,
      category: body.category,
      description: body.description,
      pageTypes: body.pageTypes,
      manifestJson: manifestForSection(body.packageName, body.componentType, body.version),
      settingsSchemaJson: settingsSchemaJson ?? emptySettings,
      isBuiltin: false,
    },
  })

  return NextResponse.json(section, { status: 201 })
}
