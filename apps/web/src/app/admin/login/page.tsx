"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setLoading(false)
      setError("Invalid email or password")
      return
    }

    const meRes = await fetch("/api/admin/me")
    if (!meRes.ok) {
      setLoading(false)
      setError("This account does not have admin access")
      return
    }

    setLoading(false)
    router.push("/admin/sections")
    router.refresh()
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Admin sign in</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Manage section packages and plugins for all shops.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Signing in…" : "Sign in as admin"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--muted)" }}>
        <Link href="/login">Shop builder sign in</Link>
      </p>
    </main>
  )
}
