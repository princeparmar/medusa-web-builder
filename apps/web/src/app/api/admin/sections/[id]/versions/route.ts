import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  assertNpmPackageVersion,
  addCatalogPackageVersion,
  listCatalogPackageVersions,
  listCatalogMedia,
} from "@mwb/registry"
import { z } from "zod"

const addVersionSchema = z.object({
  version: z.string().min(1),
  notes: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const existing = await prisma.sectionRegistry.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 })
  }

  const body = addVersionSchema.parse(await request.json())
  const npmCheck = await assertNpmPackageVersion(existing.packageName, body.version)
  if (!npmCheck.ok) {
    return NextResponse.json({ error: npmCheck.error }, { status: 400 })
  }

  const result = await addCatalogPackageVersion({
    kind: "SECTION",
    registryId: id,
    version: npmCheck.version,
    notes: body.notes,
  })

  const section = await prisma.sectionRegistry.findUnique({ where: { id } })
  const [versions, media] = await Promise.all([
    listCatalogPackageVersions("SECTION", id),
    listCatalogMedia("SECTION", id),
  ])

  return NextResponse.json({ ...section, ...result, versions, media }, { status: 201 })
}
