"use client"

import { useRef, useState } from "react"
import { uploadProjectImage } from "@/lib/upload-project-image"

export function ImageUploadField({
  projectId,
  label,
  value,
  onChange,
  hint,
  nested = false,
}: {
  projectId: string
  label: string
  value: string
  onChange: (url: string) => void
  hint?: string
  /** When true, omits outer form-group wrapper (use inside an existing labeled field). */
  nested?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError("")
    const result = await uploadProjectImage(projectId, file)
    setUploading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onChange(result.url)
  }

  const body = (
    <>
      {label && !nested ? <label>{label}</label> : null}
      {hint ? (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>{hint}</p>
      ) : null}

      {value ? (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.75rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            style={{
              height: 48,
              maxWidth: 120,
              objectFit: "contain",
              borderRadius: 4,
              background: "#fff",
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
            onClick={() => onChange("")}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.8125rem" }}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>via Medusa</span>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <label style={{ fontSize: "0.75rem", marginBottom: "0.25rem" }}>Or paste image URL</label>
        <input
          type="url"
          placeholder="https://…"
          value={value}
          onChange={(e) => {
            setError("")
            onChange(e.target.value)
          }}
        />
      </div>

      {error ? (
        <p style={{ fontSize: "0.75rem", color: "var(--error)", marginTop: "0.5rem" }}>{error}</p>
      ) : null}
    </>
  )

  if (nested) return body
  return <div className="form-group">{body}</div>
}
