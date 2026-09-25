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
  description: z.string().nullable().optional(),
  version: z.string().optional(),
  latestVersion: z.string().optional(),
  medusaResolve: z.string().optional(),
  category: z.string().optional(),
  homepageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  githubRepo: z.string().nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  settingsSchemaJson: z.unknown().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const plugin = await prisma.pluginRegistry.findUnique({ where: { id } })
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 })
  }

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("PLUGIN", id),
    listCatalogMedia("PLUGIN", id),
  ])

  return NextResponse.json({ ...plugin, versions, media })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = updateSchema.parse(await request.json())

  const existing = await prisma.pluginRegistry.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.displayName !== undefined) data.displayName = body.displayName
  if (body.description !== undefined) data.description = body.description
  if (body.medusaResolve !== undefined) data.medusaResolve = body.medusaResolve
  if (body.category !== undefined) data.category = body.category
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
      kind: "PLUGIN",
      registryId: id,
      version: npmCheck.version,
    })
  }

  // Prefer dedicated /versions route for registering newer published versions.
  // Keep latestVersion patch for backwards compatibility with older UI.
  if (body.latestVersion && body.latestVersion !== existing.latestVersion) {
    const npmCheck = await assertNpmPackageVersion(existing.packageName, body.latestVersion)
    if (!npmCheck.ok) {
      return NextResponse.json({ error: npmCheck.error }, { status: 400 })
    }
    await addCatalogPackageVersion({
      kind: "PLUGIN",
      registryId: id,
      version: npmCheck.version,
    })
  }

  const plugin = await prisma.pluginRegistry.update({
    where: { id },
    data,
  })

  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("PLUGIN", id),
    listCatalogMedia("PLUGIN", id),
  ])

  return NextResponse.json({ ...plugin, versions, media })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.catalogMedia.deleteMany({ where: { kind: "PLUGIN", registryId: id } })
  await prisma.catalogPackageVersion.deleteMany({ where: { kind: "PLUGIN", registryId: id } })
  await prisma.pluginRegistry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
