"use client"

import { useState } from "react"

export type CatalogMediaItem = {
  id: string
  type: "IMAGE" | "VIDEO"
  url: string
  filename: string
  mimeType: string
}

type Props = {
  kind: "SECTION" | "PLUGIN"
  registryId: string
  media: CatalogMediaItem[]
  onChanged: () => Promise<void> | void
}

export function CatalogMediaPanel({ kind, registryId, media, onChanged }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function upload(file: File) {
    setUploading(true)
    setError("")
    const form = new FormData()
    form.append("kind", kind)
    form.append("registryId", registryId)
    form.append("file", file)

    const res = await fetch("/api/admin/media", { method: "POST", body: form })
    const data = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) {
      setError(data.error ?? "Upload failed")
      return
    }
    await onChanged()
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this media file?")) return
    const res = await fetch(`/api/admin/media?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Could not remove media")
      return
    }
    await onChanged()
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>
        Images & videos
      </h4>
      {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {media.map((m) => (
          <div
            key={m.id}
            style={{
              width: 140,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            {m.type === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={m.filename} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
            ) : (
              <video src={m.url} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} muted />
            )}
            <div style={{ padding: "0.375rem", fontSize: "0.65rem", color: "var(--muted)", wordBreak: "break-all" }}>
              {m.filename}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.65rem", width: "100%", borderRadius: 0 }}
              onClick={() => remove(m.id)}
            >
              Remove
            </button>
          </div>
        ))}
        {media.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>No media yet.</p>
        )}
      </div>
      <label className="btn btn-secondary" style={{ fontSize: "0.75rem", cursor: uploading ? "wait" : "pointer" }}>
        {uploading ? "Uploading…" : "Upload image or video"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime"
          style={{ display: "none" }}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void upload(file)
          }}
        />
      </label>
    </div>
  )
}
