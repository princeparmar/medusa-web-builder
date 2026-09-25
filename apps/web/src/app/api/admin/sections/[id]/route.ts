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

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  version: z.string().optional(),
  componentType: z.enum(["segment", "layout"]).optional(),
  category: z.string().optional(),
  description: z.string().nullable().optional(),
  homepageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  githubRepo: z.string().nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  pageTypes: z.array(z.string()).optional(),
  settingsSchemaJson: z.unknown().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const section = await prisma.sectionRegistry.findUnique({ where: { id } })
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 })
  }

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("SECTION", id),
    listCatalogMedia("SECTION", id),
  ])

  return NextResponse.json({ ...section, versions, media })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = updateSchema.parse(await request.json())

  const existing = await prisma.sectionRegistry.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.displayName !== undefined) data.displayName = body.displayName
  if (body.componentType !== undefined) data.componentType = body.componentType
  if (body.category !== undefined) data.category = body.category
  if (body.description !== undefined) data.description = body.description
  if (body.pageTypes !== undefined) data.pageTypes = body.pageTypes
  if (body.tags !== undefined) data.tags = parseTags(body.tags)
  if (body.homepageUrl !== undefined) {
    data.homepageUrl = body.homepageUrl === "" ? null : body.homepageUrl
  }
  if (body.githubRepo !== undefined) {
    data.githubRepo = body.githubRepo?.trim() || null
  }
  if (body.settingsSchemaJson !== undefined) {
    data.settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }

  if (body.version && body.version !== existing.version) {
    const npmCheck = await assertNpmPackageVersion(existing.packageName, body.version)
    if (!npmCheck.ok) {
      return NextResponse.json({ error: npmCheck.error }, { status: 400 })
    }
    data.version = npmCheck.version
    await addCatalogPackageVersion({
      kind: "SECTION",
      registryId: id,
      version: npmCheck.version,
    })
  }

  const section = await prisma.sectionRegistry.update({
    where: { id },
    data,
  })

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("SECTION", id),
    listCatalogMedia("SECTION", id),
  ])

  return NextResponse.json({ ...section, versions, media })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.catalogMedia.deleteMany({ where: { kind: "SECTION", registryId: id } })
  await prisma.catalogPackageVersion.deleteMany({ where: { kind: "SECTION", registryId: id } })
  await prisma.sectionRegistry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
