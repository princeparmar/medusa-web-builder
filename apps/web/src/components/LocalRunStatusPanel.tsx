"use client"

type LocalRunDetails = {
  status: string
  workerStatus?: string
  savedStatus?: string
  message?: string
  backendPort: number
  storefrontPort: number
  health?: {
    backend: boolean
    storefront: boolean
    backendUrl: string
    storefrontUrl: string
  }
  queueJob?: { id: string; name: string; state: string } | null
  worker?: {
    online: boolean
    run?: {
      status?: string
      phase?: string
      action: string
      message?: string
      updatedAt: string
    } | null
  }
}

export function LocalRunStatusPanel({ localRun }: { localRun: LocalRunDetails | null }) {
  if (!localRun) return null

  const workerStatus =
    localRun.workerStatus ?? localRun.savedStatus ?? localRun.worker?.run?.status ?? "unknown"

  return (
    <div className="setup-status-panel">
      <div className="setup-status-grid">
        <div>
          <span className="setup-status-label">Display</span>
          <strong>{localRun.status}</strong>
        </div>
        <div>
          <span className="setup-status-label">Worker (Redis)</span>
          <strong>{workerStatus}</strong>
          {localRun.worker?.run?.phase && (
            <small className="setup-muted">phase: {localRun.worker.run.phase}</small>
          )}
        </div>
        <div>
          <span className="setup-status-label">Health probe</span>
          <strong>
            backend {localRun.health?.backend ? "up" : "down"} · storefront{" "}
            {localRun.health?.storefront ? "up" : "down"}
          </strong>
          {localRun.health?.backend && (
            <small className="setup-muted">{localRun.health.backendUrl}</small>
          )}
        </div>
        <div>
          <span className="setup-status-label">Worker process</span>
          <strong>{localRun.worker?.online ? "online" : "offline"}</strong>
          {localRun.worker?.run && (
            <small className="setup-muted">
              {localRun.worker.run.phase} · {localRun.worker.run.action}
            </small>
          )}
        </div>
        <div>
          <span className="setup-status-label">Queue job</span>
          <strong>
            {localRun.queueJob
              ? `${localRun.queueJob.name} (${localRun.queueJob.state})`
              : localRun.workerStatus === "starting" && localRun.worker?.run?.phase === "queued"
                ? "missing — retry start"
                : "none"}
          </strong>
        </div>
      </div>
    </div>
  )
}
