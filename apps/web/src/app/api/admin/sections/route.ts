import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin, parseTags } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import {
  assertNpmPackageVersion,
  addCatalogPackageVersion,
  listCatalogPackageVersions,
  listCatalogMedia,
} from "@mwb/registry"
import { z } from "zod"

const emptySettings = { version: "1", fields: [] }

const createSchema = z.object({
  packageName: z.string().min(3),
  displayName: z.string().min(1),
  version: z.string().min(1),
  componentType: z.enum(["segment", "layout"]).default("segment"),
  category: z.string().default("custom"),
  description: z.string().optional(),
  homepageUrl: z.union([z.string().url(), z.literal("")]).optional(),
  githubRepo: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
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

async function attachCatalogExtras(sections: Array<{ id: string }>) {
  return Promise.all(
    sections.map(async (section) => {
      const [versions, media] = await Promise.all([
        listCatalogPackageVersions("SECTION", section.id),
        listCatalogMedia("SECTION", section.id),
      ])
      return { ...section, versions, media }
    })
  )
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const sections = await prisma.sectionRegistry.findMany({
    orderBy: [{ componentType: "asc" }, { displayName: "asc" }],
  })
  return NextResponse.json({ sections: await attachCatalogExtras(sections) })
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

  const section = await prisma.sectionRegistry.create({
    data: {
      packageName: npmCheck.packageName,
      displayName: body.displayName,
      version: npmCheck.version,
      latestVersion: npmCheck.version,
      componentType: body.componentType,
      category: body.category,
      tags,
      description: body.description,
      homepageUrl,
      githubRepo,
      pageTypes: body.pageTypes,
      manifestJson: manifestForSection(npmCheck.packageName, body.componentType, npmCheck.version),
      settingsSchemaJson: settingsSchemaJson ?? emptySettings,
      isBuiltin: false,
    },
  })

  await addCatalogPackageVersion({
    kind: "SECTION",
    registryId: section.id,
    version: npmCheck.version,
  })

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("SECTION", section.id),
    listCatalogMedia("SECTION", section.id),
  ])

  return NextResponse.json({ ...section, versions, media }, { status: 201 })
}
