"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function RetrySetupButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function retry() {
    setLoading(true)
    setMessage("")
    const res = await fetch(`/api/projects/${projectId}/scaffold`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setMessage(data.error ?? "Could not restart setup")
      return
    }
    router.refresh()
  }

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button type="button" className="btn btn-primary" onClick={retry} disabled={loading}>
        {loading ? "Restarting setup…" : "Retry shop setup"}
      </button>
      {message && (
        <p style={{ fontSize: "0.8125rem", color: "var(--error)", marginTop: "0.5rem" }}>{message}</p>
      )}
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
        Setup will continue locally even if cloud backup is not configured.
      </p>
    </div>
  )
}
