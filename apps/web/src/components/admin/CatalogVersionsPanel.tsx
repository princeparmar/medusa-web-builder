"use client"

import { useState } from "react"

export type CatalogVersionItem = {
  id: string
  version: string
  notes: string | null
  createdAt: string
}

type Props = {
  versions: CatalogVersionItem[]
  pinnedVersion: string
  latestVersion: string | null
  onAddVersion: (version: string, notes?: string) => Promise<void>
  adding?: boolean
}

export function CatalogVersionsPanel({
  versions,
  pinnedVersion,
  latestVersion,
  onAddVersion,
  adding,
}: Props) {
  const [version, setVersion] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await onAddVersion(version.trim(), notes.trim() || undefined)
      setVersion("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add version")
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>
        Versions
      </h4>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
        Pinned for shops: v{pinnedVersion}
        {latestVersion ? ` · Latest registered: v${latestVersion}` : ""}
      </p>
      <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.1rem", fontSize: "0.8125rem" }}>
        {versions.map((v) => (
          <li key={v.id}>
            v{v.version}
            {v.notes ? ` — ${v.notes}` : ""}
          </li>
        ))}
        {versions.length === 0 && <li style={{ color: "var(--muted)" }}>No versions recorded</li>}
      </ul>
      {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end" }}>
        <div className="form-group" style={{ margin: 0, minWidth: 120 }}>
          <label>New npm version</label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.2.0"
            required
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Release notes" />
        </div>
        <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={adding}>
          {adding ? "Adding…" : "Add version"}
        </button>
      </form>
    </div>
  )
}
