import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { z } from "zod"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  readShopEnv,
  writeShopEnv,
  syncAutoStorefrontEnv,
  SHOP_BACKEND_ENV_FIELDS,
  SHOP_AUTO_ENV_FIELDS,
} from "@mwb/core/shops"

const BACKEND_KEYS = new Set(SHOP_BACKEND_ENV_FIELDS.map((f) => f.key))

function pickBackendValues(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([k]) => BACKEND_KEYS.has(k)))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({
      ready: false,
      values: {},
      fields: SHOP_BACKEND_ENV_FIELDS,
      autoFields: SHOP_AUTO_ENV_FIELDS,
      autoValues: {},
    })
  }

  const shopPath = resolve(project.workspacePath)
  const all = await readShopEnv(shopPath)
  const values = pickBackendValues(all)
  const autoValues = Object.fromEntries(
    SHOP_AUTO_ENV_FIELDS.map((f) => [f.key, all[f.key] ?? ""]).filter(([, v]) => v !== "")
  )

  return NextResponse.json({
    ready: true,
    values,
    fields: SHOP_BACKEND_ENV_FIELDS,
    autoFields: SHOP_AUTO_ENV_FIELDS,
    autoValues,
  })
}

const patchSchema = z.object({
  values: z.record(z.string()),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Shop not ready" }, { status: 400 })
  }

  const body = patchSchema.parse(await request.json())
  const shopPath = resolve(project.workspacePath)
  const backendPatch = pickBackendValues(body.values)

  await writeShopEnv(shopPath, project.slug, backendPatch)
  const { synced: autoValues, missing } = await syncAutoStorefrontEnv(shopPath, project.slug)
  const values = pickBackendValues(await readShopEnv(shopPath))

  return NextResponse.json({ ok: true, values, autoValues, missing })
}

const syncSchema = z.object({
  action: z.literal("sync-storefront"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Shop not ready" }, { status: 400 })
  }

  syncSchema.parse(await request.json())
  const shopPath = resolve(project.workspacePath)
  const { synced: autoValues, missing, publishableKeyStatus } = await syncAutoStorefrontEnv(
    shopPath,
    project.slug
  )

  return NextResponse.json({ ok: true, autoValues, missing, publishableKeyStatus })
}
