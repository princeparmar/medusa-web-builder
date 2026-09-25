import { NextResponse } from "next/server"
import { prisma, type CatalogKind, type CatalogMediaType } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import {
  buildCatalogObjectKey,
  deleteCatalogObject,
  getCatalogS3Config,
  uploadCatalogObject,
} from "@mwb/core/catalog-s3"

const IMAGE_MAX = 10 * 1024 * 1024
const VIDEO_MAX = 100 * 1024 * 1024

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
])
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])

async function registryExists(kind: CatalogKind, registryId: string): Promise<boolean> {
  if (kind === "SECTION") {
    return Boolean(await prisma.sectionRegistry.findUnique({ where: { id: registryId } }))
  }
  return Boolean(await prisma.pluginRegistry.findUnique({ where: { id: registryId } }))
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  if (!getCatalogS3Config()) {
    return NextResponse.json(
      {
        error:
          "Catalog S3 is not configured. Set CATALOG_S3_BUCKET, CATALOG_S3_REGION, CATALOG_S3_ACCESS_KEY_ID, CATALOG_S3_SECRET_ACCESS_KEY, and CATALOG_S3_PUBLIC_URL.",
      },
      { status: 503 }
    )
  }

  const form = await request.formData()
  const kindRaw = String(form.get("kind") ?? "").toUpperCase()
  const registryId = String(form.get("registryId") ?? "")
  const file = form.get("file")

  if (kindRaw !== "SECTION" && kindRaw !== "PLUGIN") {
    return NextResponse.json({ error: "kind must be SECTION or PLUGIN" }, { status: 400 })
  }
  if (!registryId) {
    return NextResponse.json({ error: "registryId is required" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const kind = kindRaw as CatalogKind
  if (!(await registryExists(kind, registryId))) {
    return NextResponse.json({ error: "Catalog entry not found" }, { status: 404 })
  }

  const mimeType = file.type || "application/octet-stream"
  let mediaType: CatalogMediaType
  if (IMAGE_TYPES.has(mimeType)) {
    mediaType = "IMAGE"
    if (file.size > IMAGE_MAX) {
      return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 400 })
    }
  } else if (VIDEO_TYPES.has(mimeType)) {
    mediaType = "VIDEO"
    if (file.size > VIDEO_MAX) {
      return NextResponse.json({ error: "Videos must be 100 MB or smaller" }, { status: 400 })
    }
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Upload an image (jpeg, png, webp, gif, svg) or video (mp4, webm, mov)." },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const key = buildCatalogObjectKey({
    kind: kind === "SECTION" ? "section" : "plugin",
    registryId,
    filename: file.name,
  })

  try {
    const uploaded = await uploadCatalogObject({
      key,
      body: buffer,
      contentType: mimeType,
    })

    const media = await prisma.catalogMedia.create({
      data: {
        kind,
        registryId,
        type: mediaType,
        url: uploaded.url,
        key: uploaded.key,
        filename: file.name,
        mimeType,
        sizeBytes: file.size,
      },
    })

    return NextResponse.json({ media }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const media = await prisma.catalogMedia.findUnique({ where: { id } })
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 })
  }

  try {
    if (getCatalogS3Config()) {
      await deleteCatalogObject(media.key)
    }
  } catch {
    // Still remove the DB row if the object is already gone
  }

  await prisma.catalogMedia.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
