"use client"

import { useCallback, useEffect, useState } from "react"

type AdminUser = {
  id: string
  email: string
  name: string | null
  adminRole: "SUPER_ADMIN" | "ADMIN"
  createdAt: string
}

const emptyForm = {
  email: "",
  password: "",
  name: "",
  role: "ADMIN" as "ADMIN" | "SUPER_ADMIN",
}

export default function AdminAdminsClient() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/admins")
    if (res.status === 403) {
      setForbidden(true)
      return
    }
    if (res.ok) {
      const data = await res.json()
      setAdmins(data.admins ?? [])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        role: form.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? "Could not create admin")
      return
    }

    setMessage(`Added ${data.admin?.email}`)
    setForm(emptyForm)
    await load()
  }

  async function removeAdmin(id: string, email: string) {
    if (!window.confirm(`Remove admin access for ${email}?`)) return
    setError("")
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? "Could not remove admin")
      return
    }
    setMessage(`Removed admin access for ${email}`)
    await load()
  }

  if (forbidden) {
    return (
      <main className="container" style={{ padding: "2rem 0" }}>
        <div className="alert alert-error">Super admin access is required to manage admins.</div>
      </main>
    )
  }

  return (
    <main className="container" style={{ padding: "2rem 0 3rem", maxWidth: 800 }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Admins</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Create and remove admin accounts. Super admins manage this list; all admins can register catalog packages.
      </p>

      {message && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Add admin</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                minLength={8}
                required
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "SUPER_ADMIN" }))
                }
              >
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating…" : "Create admin"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Current admins</h2>
        {admins.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No admins found.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {admins.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div>
                  <strong>{a.name || a.email}</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {a.email} · {a.adminRole === "SUPER_ADMIN" ? "Super admin" : "Admin"}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.75rem", alignSelf: "start" }}
                  onClick={() => removeAdmin(a.id, a.email)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
