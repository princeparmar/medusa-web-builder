import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { canLoadSegments } from "@/lib/segment-preview/load-segment"
import { buildBrandFontAssets } from "@/lib/brand-config"
import { prisma } from "@mwb/db"

export const runtime = "nodejs"

function previewStyles(): string {
  const root = process.env.STOREFRONT_COMPONENTS_PATH
  if (!root) return ""
  const impulse = join(root, "packages", "segment-tokens", "themes", "impulse.css")
  if (!existsSync(impulse)) return ""
  return readFileSync(impulse, "utf8")
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  if (!canLoadSegments()) {
    return NextResponse.json(
      { error: "STOREFRONT_COMPONENTS_PATH is not configured" },
      { status: 503 }
    )
  }

  const body = await request.json()
  const route = typeof body.route === "string" ? body.route : "/"
  const pages = Array.isArray(body.pages) ? body.pages : []
  const sectionProps =
    body.sectionProps && typeof body.sectionProps === "object" ? body.sectionProps : {}
  const brand = body.brand && typeof body.brand === "object" ? body.brand : {}

  const registry = await prisma.sectionRegistry.findMany()
  const sections = registry.map((s) => {
    const manifest = s.manifestJson as { dataKey?: string } | null
    return {
      packageName: s.packageName,
      displayName: s.displayName,
      dataKey: manifest?.dataKey,
      settingsSchema: (s.settingsSchemaJson ?? null) as import("@mwb/core/builder-config").BuilderSettings | null,
    }
  })

  try {
    const [{ renderToStaticMarkup }, { renderLivePreview }] = await Promise.all([
      import("react-dom/server"),
      import("@/lib/segment-preview/render-preview"),
    ])
    const markup = renderToStaticMarkup(
      await renderLivePreview({ pages, route, sectionProps, brand, sections })
    )
    const themeCss = previewStyles()
    const { googleLink, styleBlock } = buildBrandFontAssets(brand)
    const googleTag = googleLink
      ? `<link rel="stylesheet" href="${googleLink}" crossorigin="anonymous" />`
      : ""
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${googleTag}<style>${themeCss}\n${styleBlock}</style></head><body>${markup}</body></html>`

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview render failed"
    console.error("[preview]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
