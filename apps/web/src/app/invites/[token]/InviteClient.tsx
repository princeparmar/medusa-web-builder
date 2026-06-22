"use client"

import { useState } from "react"
import Link from "next/link"

export default function InviteAcceptPage({ token }: { token: string }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function accept() {
    setLoading(true)
    const res = await fetch(`/api/invites/${token}`, { method: "POST" })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      window.location.href = `/projects/${data.projectId}`
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to accept invite")
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Project invitation</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="button" className="btn btn-primary" onClick={accept} disabled={loading} style={{ marginTop: "1rem" }}>
          {loading ? "Accepting..." : "Accept invitation"}
        </button>
        <p style={{ marginTop: "1rem" }}>
          <Link href="/login">Sign in first</Link> if you have an account.
        </p>
      </div>
    </main>
  )
}
