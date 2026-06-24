import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { BuilderSettingsSchema } from "@mwb/registry/schemas"
import { z } from "zod"

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  version: z.string().optional(),
  latestVersion: z.string().optional(),
  medusaResolve: z.string().optional(),
  category: z.string().optional(),
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

  return NextResponse.json(plugin)
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

  const data: Record<string, unknown> = { ...body }
  if (body.settingsSchemaJson !== undefined) {
    data.settingsSchemaJson = BuilderSettingsSchema.parse(body.settingsSchemaJson) as object
  }
  if (body.version) {
    data.latestVersion = body.version
  }
  if (body.latestVersion) {
    data.latestVersion = body.latestVersion
  }

  const plugin = await prisma.pluginRegistry.update({
    where: { id },
    data,
  })

  return NextResponse.json(plugin)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.pluginRegistry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
