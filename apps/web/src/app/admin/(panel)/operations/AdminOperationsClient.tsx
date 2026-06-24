"use client"

import { useCallback, useEffect, useState } from "react"

type OpsResponse = {
  worker: { online: boolean; lastSeenMs: number | null; redisUrl: string }
  queueJobs: Array<{
    queue: string
    id: string
    name: string
    state: string
    projectId?: string
    slug?: string
    timestamp: number
  }>
  workerRuns: Array<{
    projectId: string
    slug: string
    action: string
    phase: string
    jobId?: string
    message?: string
    updatedAt: string
  }>
  servers: Array<{
    projectId: string
    projectName: string
    slug: string
    projectStatus: string
    owners: string[]
    local: {
      status: string
      savedStatus: string
      message?: string
      backendPort: number
      storefrontPort: number
      health: { backend: boolean; storefront: boolean; backendUrl: string; storefrontUrl: string }
    }
    workerRun: { phase: string; action: string; message?: string; updatedAt: string } | null
    jobs: Array<{ id: string; name: string; state: string; queue: string }>
  }>
}

function statusBadge(status: string) {
  if (status === "running" || status === "backend_running") return "ready"
  if (status === "starting" || status === "stopping") return "pending"
  if (status === "error") return "error"
  return "pending"
}

export function AdminOperationsClient() {
  const [data, setData] = useState<OpsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const res = await fetch("/api/admin/operations")
    if (!res.ok) {
      setError("Failed to load operations")
      setLoading(false)
      return
    }
    setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  if (loading && !data) {
    return <p className="setup-muted">Loading operations…</p>
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>
  }

  if (!data) return null

  return (
    <div>
      <div className="card setup-card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Worker</h2>
        <p className="setup-muted" style={{ marginBottom: 0 }}>
          {data.worker.online ? (
            <span style={{ color: "#16a34a" }}>Online</span>
          ) : (
            <span style={{ color: "#dc2626" }}>Offline</span>
          )}
          {" · "}
          Redis: <code>{data.worker.redisUrl}</code>
          {data.worker.lastSeenMs && (
            <>
              {" · "}
              Last heartbeat: {new Date(data.worker.lastSeenMs).toLocaleTimeString()}
            </>
          )}
        </p>
      </div>

      <div className="card setup-card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Queue jobs</h2>
        {data.queueJobs.length === 0 ? (
          <p className="setup-muted">No active or waiting jobs.</p>
        ) : (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Job</th>
                  <th>State</th>
                  <th>Project</th>
                  <th>Slug</th>
                </tr>
              </thead>
              <tbody>
                {data.queueJobs.map((job) => (
                  <tr key={`${job.queue}-${job.id}`}>
                    <td>{job.queue}</td>
                    <td>
                      <code>{job.name}</code>
                    </td>
                    <td>{job.state}</td>
                    <td>
                      {job.projectId ? (
                        <a href={`/projects/${job.projectId}`}>{job.projectId.slice(0, 8)}…</a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{job.slug ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card setup-card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Local servers</h2>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Health</th>
                <th>Worker</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {data.servers.map((row) => (
                <tr key={row.projectId}>
                  <td>
                    <a href={`/projects/${row.projectId}`}>
                      <strong>{row.projectName}</strong>
                    </a>
                    <div className="setup-muted" style={{ fontSize: "0.75rem" }}>
                      {row.slug}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>{row.owners.join(", ") || "—"}</td>
                  <td>
                    <span className={`badge badge-${statusBadge(row.local.status)}`}>
                      {row.local.status}
                    </span>
                    {row.local.savedStatus !== row.local.status && (
                      <div className="setup-muted" style={{ fontSize: "0.7rem" }}>
                        worker: {row.local.savedStatus}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    backend {row.local.health.backend ? "✓" : "✗"} · storefront{" "}
                    {row.local.health.storefront ? "✓" : "✗"}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {row.workerRun ? (
                      <>
                        {row.workerRun.phase} ({row.workerRun.action})
                      </>
                    ) : row.jobs[0] ? (
                      <>queue: {row.jobs[0].state}</>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {row.local.backendPort}/{row.local.storefrontPort}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
