export type UploadProjectImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function uploadProjectImage(
  projectId: string,
  file: File
): Promise<UploadProjectImageResult> {
  const form = new FormData()
  form.append("files", file)

  let data: { error?: string; details?: string; files?: Array<{ medusaFileUrl?: string }> }
  try {
    const res = await fetch(`/api/projects/${projectId}/upload`, { method: "POST", body: form })
    data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error ?? data.details ?? "Upload failed" }
    }
  } catch {
    return { ok: false, error: "Upload failed — check your connection" }
  }

  const url = data.files?.[0]?.medusaFileUrl
  if (!url) return { ok: false, error: "Upload succeeded but no image URL was returned" }
  return { ok: true, url }
}
