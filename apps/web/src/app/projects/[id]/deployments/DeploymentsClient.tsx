"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type DeploymentListItem = {
  id: string
  tag: string
  status: string
  releaseUrl?: string | null
  releaseNotes?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt?: string
  source: "database" | "github" | "merged"
  workflowRun?: {
    id: number
    status: string
    conclusion: string | null
    htmlUrl: string
    workflowName: string
    event: string
  }
}

type DeploymentsResponse = {
  deployments: DeploymentListItem[]
  githubRepo: string
  githubActionsUrl: string
  githubConfigured: boolean
  githubError: string | null
}

function workflowStatusLabel(run: DeploymentListItem["workflowRun"]): string {
  if (!run) return ""
  if (run.status === "completed") {
    return run.conclusion === "success" ? "Succeeded" : run.conclusion ?? "Completed"
  }
  if (run.status === "in_progress") return "Running"
  if (run.status === "queued") return "Queued"
  return run.status
}

export default function DeploymentsClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [data, setData] = useState<DeploymentsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/deployments`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const deployments = data?.deployments ?? []
  const hasActive = deployments.some(
    (d) => d.status === "BUILDING" || d.status === "PENDING" || d.status === "DEPLOYING"
  )

  return (
    <main className="container" style={{ paddingTop: "2rem", maxWidth: 900 }}>
      <Link href={`/projects/${projectId}`} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
        ← {projectName}
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.5rem", marginBottom: "2rem", gap: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Deployments</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Release builds from GitHub Actions
            {data?.githubRepo ? ` · ${data.githubRepo}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {data?.githubActionsUrl && (
            <a
              href={data.githubActionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: "0.875rem" }}
            >
              Open in GitHub
            </a>
          )}
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} style={{ fontSize: "0.875rem" }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {data?.githubError && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          Could not load GitHub Actions: {data.githubError}
        </div>
      )}

      {!data?.githubConfigured && (
        <div className="alert" style={{ marginBottom: "1rem", background: "var(--surface)", border: "1px solid var(--border)" }}>
          GitHub App credentials not configured — showing builder publish history only.
        </div>
      )}

      {hasActive && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Auto-refreshing every 15s while a deployment is in progress.
        </p>
      )}

      {loading && deployments.length === 0 ? (
        <div className="card"><p style={{ color: "var(--muted)" }}>Loading deployments…</p></div>
      ) : deployments.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            No releases yet. Publish from the builder to create a tag and trigger the Release Build workflow.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 1rem", color: "var(--muted)", fontWeight: 500 }}>Release</th>
                <th style={{ padding: "0.75rem 1rem", color: "var(--muted)", fontWeight: 500 }}>GitHub Actions</th>
                <th style={{ padding: "0.75rem 1rem", color: "var(--muted)", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", color: "var(--muted)", fontWeight: 500 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                    <strong>{d.tag}</strong>
                    {d.releaseNotes && (
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", maxWidth: 280 }}>
                        {d.releaseNotes.length > 120 ? `${d.releaseNotes.slice(0, 120)}…` : d.releaseNotes}
                      </p>
                    )}
                    {d.releaseUrl && (
                      <a
                        href={d.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", display: "inline-block", marginTop: "0.25rem" }}
                      >
                        GitHub Release
                      </a>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                    {d.workflowRun ? (
                      <>
                        <a
                          href={d.workflowRun.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.8125rem" }}
                        >
                          {d.workflowRun.workflowName}
                        </a>
                        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                          {workflowStatusLabel(d.workflowRun)}
                          {d.workflowRun.event ? ` · ${d.workflowRun.event}` : ""}
                        </p>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                    <span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span>
                    {d.errorMessage && (
                      <p style={{ fontSize: "0.7rem", color: "var(--error, #e94560)", marginTop: "0.25rem" }}>
                        {d.errorMessage}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", verticalAlign: "top", color: "var(--muted)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
