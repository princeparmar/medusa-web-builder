"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function OnboardingProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [preset, setPreset] = useState<"full" | "minimal">("full")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, preset }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create project")
      return
    }

    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <main className="container" style={{ maxWidth: 480, paddingTop: "3rem" }}>
      <h1>Create your first project</h1>
      <p style={{ color: "var(--muted)", margin: "0.5rem 0 2rem" }}>Step 2 of 2</p>

      {error && <div className="alert alert-error">{JSON.stringify(error)}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label htmlFor="name">Project name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="preset">Preset</label>
          <select
            id="preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as "full" | "minimal")}
          >
            <option value="full">Full (all pages + plugins)</option>
            <option value="minimal">Minimal (core pages)</option>
          </select>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
          A private repo will be created at medusa-storefronts/storefront-&#123;uuid&#125;
        </p>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create project"}
        </button>
      </form>
    </main>
  )
}
