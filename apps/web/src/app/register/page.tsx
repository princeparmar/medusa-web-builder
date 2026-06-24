"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Registration failed")
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <main className="container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
        <div className="card">
          <h1>Check your email</h1>
          <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
            We sent a verification link to <strong>{email}</strong>. Check Mailpit at{" "}
            <a
              href={process.env.NEXT_PUBLIC_MAILPIT_URL ?? "http://localhost:8125"}
              target="_blank"
              rel="noreferrer"
            >
              {process.env.NEXT_PUBLIC_MAILPIT_URL?.replace(/^https?:\/\//, "") ?? "localhost:8125"}
            </a>{" "}
            in local dev.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: "1.5rem" }}>
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Create account</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password (min 8 characters)</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </main>
  )
}
