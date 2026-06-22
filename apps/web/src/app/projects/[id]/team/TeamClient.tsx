"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export default function TeamPage({ projectId, projectName, canInvite }: { projectId: string; projectName: string; canInvite: boolean }) {
  const [members, setMembers] = useState<Array<{ role: string; user: { name: string; email: string } }>>([])
  const [invites, setInvites] = useState<Array<{ email: string; role: string; status: string }>>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("DEVELOPER")
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? [])
        setInvites(data.invites ?? [])
      })
  }, [projectId])

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${projectId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    })
    if (res.ok) {
      setMessage("Invite sent")
      setEmail("")
      const data = await fetch(`/api/projects/${projectId}`).then((r) => r.json())
      setInvites(data.invites ?? [])
    } else {
      const err = await res.json()
      setMessage(err.error ?? "Failed")
    }
  }

  return (
    <main className="container" style={{ paddingTop: "2rem" }}>
      <Link href={`/projects/${projectId}`} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
        ← {projectName}
      </Link>
      <h1 style={{ marginTop: "0.5rem", marginBottom: "2rem" }}>Team</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Members</h2>
        {members.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
            <span>{m.user.name ?? m.user.email}</span>
            <span className="badge">{m.role}</span>
          </div>
        ))}
      </div>

      {canInvite && (
        <form onSubmit={sendInvite} className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Invite member</h2>
          {message && <div className="alert alert-success">{message}</div>}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="MANAGER">Manager</option>
              <option value="DEVELOPER">Developer</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Send invite</button>
        </form>
      )}

      {invites.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Pending invites</h2>
          {invites.map((inv) => (
            <div key={inv.email} style={{ fontSize: "0.875rem", padding: "0.375rem 0" }}>
              {inv.email} — {inv.role}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
