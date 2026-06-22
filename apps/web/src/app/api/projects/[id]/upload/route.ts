import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import { decrypt } from "@mwb/core/crypto"
import { logAudit } from "@mwb/core/audit"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, session } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const secrets = await prisma.projectSecret.findUnique({ where: { projectId: id } })
  if (!secrets?.encryptedAdminToken || !secrets.backendUrl) {
    return NextResponse.json(
      { error: "Project Medusa backend not configured yet" },
      { status: 400 }
    )
  }

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  const adminToken = decrypt(secrets.encryptedAdminToken)
  const backendUrl = secrets.backendUrl.replace(/\/$/, "")

  const uploadForm = new FormData()
  for (const file of files) {
    uploadForm.append("files", file)
  }

  const medusaRes = await fetch(`${backendUrl}/admin/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: uploadForm,
  })

  if (!medusaRes.ok) {
    const errText = await medusaRes.text()
    return NextResponse.json(
      { error: "Medusa upload failed", details: errText },
      { status: 502 }
    )
  }

  const result = await medusaRes.json()
  const uploadedFiles = result.files ?? result.uploads ?? [result]

  const assets = await Promise.all(
    uploadedFiles.map(async (f: { url?: string; id?: string }, i: number) => {
      const file = files[i]
      return prisma.asset.create({
        data: {
          projectId: id,
          medusaFileUrl: f.url ?? String(f.id),
          filename: file?.name ?? "upload",
          mimeType: file?.type ?? "application/octet-stream",
          sizeBytes: file?.size,
        },
      })
    })
  )

  await logAudit({
    userId: session!.user.id,
    projectId: id,
    action: "asset.upload",
    metadata: { count: assets.length },
  })

  return NextResponse.json({ files: assets })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const assets = await prisma.asset.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(assets)
}
