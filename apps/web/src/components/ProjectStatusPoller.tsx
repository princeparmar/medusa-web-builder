"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function ProjectStatusPoller({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState("Setting up your storefront...")

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return
      const project = await res.json()
      if (project.status === "READY") {
        setMessage("Project ready!")
        router.refresh()
        clearInterval(interval)
      } else if (project.status === "ERROR") {
        setMessage(project.errorMessage ?? "Setup failed")
        router.refresh()
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [projectId, router])

  return (
    <div className="card" style={{ marginBottom: "1.5rem", textAlign: "center", padding: "2rem" }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 1rem",
        }}
      />
      <p>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
