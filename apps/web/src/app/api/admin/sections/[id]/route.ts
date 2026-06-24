import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import { z } from "zod"

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  version: z.string().optional(),
  componentType: z.enum(["segment", "layout"]).optional(),
  category: z.string().optional(),
  description: z.string().nullable().optional(),
  pageTypes: z.array(z.string()).optional(),
  settingsSchemaJson: z.unknown().optional(),
})

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

  const data: Record<string, unknown> = { ...body }
  if (body.settingsSchemaJson !== undefined) {
    data.settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }
  if (body.version) {
    data.latestVersion = body.version
  }

  const section = await prisma.sectionRegistry.update({
    where: { id },
    data,
  })

  return NextResponse.json(section)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.sectionRegistry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
