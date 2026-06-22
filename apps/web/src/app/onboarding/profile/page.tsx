"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function OnboardingProfilePage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [companyName, setCompanyName] = useState("")
  const [defaultRegion, setDefaultRegion] = useState("in")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, defaultRegion }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to save profile")
      return
    }

    await update({ onboardingStep: "PROFILE_COMPLETE" })
    router.push("/onboarding/project")
  }

  return (
    <main className="container" style={{ maxWidth: 480, paddingTop: "3rem" }}>
      <h1>Complete your profile</h1>
      <p style={{ color: "var(--muted)", margin: "0.5rem 0 2rem" }}>
        Step 1 of 2
        {session?.user?.name ? (
          <>
            {" "}
            — signed in as <strong>{session.user.name}</strong>
          </>
        ) : null}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label htmlFor="company">Company name</label>
          <input
            id="company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="region">Default region</label>
          <select
            id="region"
            value={defaultRegion}
            onChange={(e) => setDefaultRegion(e.target.value)}
          >
            <option value="in">India (in)</option>
            <option value="us">United States (us)</option>
            <option value="gb">United Kingdom (gb)</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </main>
  )
}
