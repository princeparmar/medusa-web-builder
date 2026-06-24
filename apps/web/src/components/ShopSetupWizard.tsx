"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BackendPluginsPanel, BackendProvidersPanel } from "@/components/settings/BackendConfigPanels"
import { LocalRunStatusPanel } from "@/components/LocalRunStatusPanel"
import { BuilderAccessLink } from "@/components/BuilderAccessLink"
import { ProcessLogsModal, ViewLogsButton } from "@/components/ProcessLogsModal"

type EnvField = {
  key: string
  label: string
  group: string
  secret?: boolean
}

type AutoEnvField = {
  key: string
  label: string
  source: string
}

type LocalRunState = {
  status: string
  workerStatus?: string
  savedStatus?: string
  backendPort: number
  storefrontPort: number
  message?: string
  logs?: string[]
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
      phase: string
      action: string
      message?: string
      updatedAt: string
    } | null
  }
  hold?: {
    stalled: boolean
    elapsedMs: number
    holdReason?: string
    suggestAction?: "wait" | "retry" | "stop" | "check-worker"
  }
}

const PUBLISHABLE_KEY = "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function isSyncedPublishableKey(value: string) {
  return value.startsWith("pk_") && value !== "pk_test"
}

const GROUP_LABELS: Record<string, string> = {
  core: "Core secrets",
  auth: "Authentication",
  payment: "Payments",
  fulfillment: "Fulfillment",
  notification: "Email & SMS",
  storage: "File storage",
}

function maskSecret(value: string) {
  if (value.length <= 8) return "••••••••"
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export function ShopSetupWizard({
  projectId,
  projectName,
  shopSlug,
}: {
  projectId: string
  projectName: string
  shopSlug: string
}) {
  const [step, setStep] = useState<"backend" | "storefront">("backend")
  const [envFields, setEnvFields] = useState<EnvField[]>([])
  const [autoFields, setAutoFields] = useState<AutoEnvField[]>([])
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [autoValues, setAutoValues] = useState<Record<string, string>>({})
  const [syncMissing, setSyncMissing] = useState<string[]>([])
  const [pkNeedsSeed, setPkNeedsSeed] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedRun, setSeedRun] = useState<{ status: string; message?: string }>({ status: "idle" })
  const [seedLogs, setSeedLogs] = useState<string[]>([])
  const [logsModal, setLogsModal] = useState<null | { kind: "backend" | "storefront" | "seed"; title: string }>(
    null
  )
  const [localRun, setLocalRun] = useState<LocalRunState | null>(null)
  const [localLogs, setLocalLogs] = useState<string[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobHint, setJobHint] = useState("")
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null)
  const [loadingEnv, setLoadingEnv] = useState(true)
  const [savingEnv, setSavingEnv] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [runningAction, setRunningAction] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [adminCredentials, setAdminCredentials] = useState<{
    email: string
    password: string
    adminUrl: string
  } | null>(null)
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  const loadSeed = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/seed?tail=400`)
    if (res.ok) {
      const data = await res.json()
      setSeedRun({ status: data.status ?? "idle", message: data.message })
      setSeedLogs(data.logs ?? [])
    }
  }, [projectId])

  const openProcessLogs = (kind: "backend" | "storefront" | "seed") => {
    const titles = {
      backend: "Backend start logs",
      storefront: "Storefront start logs",
      seed: "Database seed logs",
    }
    setLogsModal({ kind, title: titles[kind] })
    if (kind === "seed") void loadSeed()
    else void loadLocal()
  }

  const loadEnv = useCallback(async () => {
    setLoadingEnv(true)
    const res = await fetch(`/api/projects/${projectId}/env`)
    if (res.ok) {
      const data = await res.json()
      setEnvFields(data.fields ?? [])
      setAutoFields(data.autoFields ?? [])
      setEnvValues(data.values ?? {})
      setAutoValues(data.autoValues ?? {})
    }
    setLoadingEnv(false)
  }, [projectId])

  const syncStorefront = useCallback(async () => {
    setSyncing(true)
    const res = await fetch(`/api/projects/${projectId}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-storefront" }),
    })
    setSyncing(false)
    if (res.ok) {
      const data = await res.json()
      setAutoValues(data.autoValues ?? {})
      setSyncMissing(data.missing ?? [])
      setPkNeedsSeed(
        Boolean(
          data.publishableKeyStatus?.reachable &&
            (data.publishableKeyStatus?.keyCount ?? 0) === 0
        )
      )
    }
  }, [projectId])

  async function runSeed() {
    setSeeding(true)
    setMessage("")
    setLogsModal({ kind: "seed", title: "Database seed logs" })
    void loadSeed()
    const res = await fetch(`/api/projects/${projectId}/seed`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setSeeding(false)
    void loadSeed()
    if (res.ok) {
      setAutoValues(data.autoValues ?? {})
      setSyncMissing(data.missing ?? [])
      setPkNeedsSeed(
        Boolean(
          data.publishableKeyStatus?.reachable &&
            (data.publishableKeyStatus?.keyCount ?? 0) === 0
        )
      )
      setSeedRun({ status: data.status ?? "completed", message: data.message })
      if (Array.isArray(data.logs)) setSeedLogs(data.logs)
      setMessageType(data.missing?.length ? "error" : "success")
      setMessage(
        data.missing?.length
          ? (data.missing[0] as string)
          : (data.message ?? "Seed complete — publishable key synced.")
      )
    } else {
      setSeedRun({ status: data.status ?? "error", message: data.error })
      if (Array.isArray(data.logs)) setSeedLogs(data.logs)
      setMessageType("error")
      setMessage(data.error ?? "Seed failed — open logs for details")
    }
  }

  const loadWorkerStatus = useCallback(async () => {
    const res = await fetch("/api/worker/status")
    if (res.ok) {
      const data = await res.json()
      setWorkerOnline(Boolean(data.online))
    }
  }, [])

  const loadAdmin = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/admin`)
    if (res.ok) {
      const data = await res.json()
      setAdminCredentials(data.credentials ?? null)
    }
  }, [projectId])

  const loadLocal = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/local?tail=300`)
    if (res.ok) {
      const data = await res.json()
      setLocalRun(data)
      if (Array.isArray(data.logs)) setLocalLogs(data.logs)
    }
  }, [projectId])

  useEffect(() => {
    loadEnv()
    loadLocal()
    void loadSeed()
    void loadWorkerStatus()
    const intervalMs =
      localRun?.hold?.stalled ||
      localRun?.status === "starting" ||
      localRun?.status === "stopping" ||
      localRun?.workerStatus === "starting" ||
      (localRun?.health?.backend && localRun.status === "stopped")
        ? 1000
        : 5000
    const t = setInterval(() => {
      void loadLocal()
      void loadWorkerStatus()
    }, intervalMs)
    return () => clearInterval(t)
  }, [loadEnv, loadLocal, loadWorkerStatus, localRun?.status])

  useEffect(() => {
    if (!seeding) return
    const t = setInterval(() => void loadSeed(), 1000)
    return () => clearInterval(t)
  }, [seeding, loadSeed])

  useEffect(() => {
    if (!activeJobId) return
    let waitingSince = Date.now()
    const poll = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}/jobs/${activeJobId}`)
      if (!res.ok) return
      const job = await res.json()
      if (job.state === "waiting" || job.state === "delayed") {
        if (Date.now() - waitingSince > 12_000) {
          setJobHint(
            workerOnline === false
              ? "No worker is running. Start it in another terminal: pnpm dev:worker"
              : "Job is still waiting in the queue — try stopping and running again."
          )
          setMessageType("error")
        }
        return
      }
      if (job.state === "active") {
        setJobHint("")
        waitingSince = Date.now()
        return
      }
      if (job.state === "failed") {
        setMessageType("error")
        setMessage(job.failedReason ?? "Local run job failed")
        setJobHint("")
        setActiveJobId(null)
        void loadLocal()
        return
      }
      if (job.state === "completed") {
        setJobHint("")
        setActiveJobId(null)
        void loadLocal()
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [activeJobId, projectId, loadLocal, workerOnline])

  useEffect(() => {
    if (localRun?.status !== "backend_running" && localRun?.status !== "running") return
    void syncStorefront()
  }, [localRun?.status, syncStorefront])

  async function runLocal(action: "start" | "start-storefront" | "stop") {
    setRunningAction(true)
    setMessage("")
    setJobHint("")
    setActiveJobId(null)
    if (action === "start") setLocalLogs([])
    if (action === "stop") {
      setLocalRun((prev) =>
        prev
          ? { ...prev, status: "stopping", message: "Stopping local servers…" }
          : { status: "stopping", backendPort: 9000, storefrontPort: 8000, message: "Stopping…" }
      )
    }
    const res = await fetch(`/api/projects/${projectId}/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setRunningAction(false)
    if (res.ok) {
      const data = await res.json()
      if (data.immediate) {
        setLocalRun(data)
        setActiveJobId(null)
        setMessageType("success")
        setMessage("Local servers stopped.")
        void loadLocal()
        return
      }
      if (data.jobId) setActiveJobId(data.jobId)
      void loadWorkerStatus()
      if (action === "start") {
        setLogsModal({ kind: "backend", title: "Backend start logs" })
      } else if (action === "start-storefront") {
        setLogsModal({ kind: "storefront", title: "Storefront start logs" })
      }
      if (workerOnline === false) {
        setMessageType("error")
        setMessage("Job queued, but no worker is running. Start: pnpm dev:worker")
      } else {
        setMessageType("success")
        setMessage(
          action === "start"
            ? "Starting backend… open logs to watch progress."
            : action === "start-storefront"
              ? "Starting storefront… open logs to watch progress."
              : "Stopping local servers…"
        )
      }
      void loadLocal()
    } else {
      setMessageType("error")
      setMessage("Could not queue local run — is Redis running? Try: pnpm dev:worker")
    }
  }

  const backendLive =
    localRun?.status === "backend_running" ||
    localRun?.status === "running" ||
    Boolean(localRun?.health?.backend)
  const storefrontLive =
    localRun?.status === "running" || Boolean(localRun?.health?.storefront)
  const displayStatus = storefrontLive
    ? "running"
    : backendLive
      ? "backend_running"
      : (localRun?.status ?? "unknown")
  const medusaAdminUrl = `http://localhost:${localRun?.backendPort ?? 9000}/app`

  useEffect(() => {
    if (step === "backend") void loadAdmin()
  }, [step, loadAdmin])

  useEffect(() => {
    if (!backendLive) return
    void loadAdmin()
  }, [backendLive, loadAdmin])

  useEffect(() => {
    if (step !== "storefront" || !backendLive) return
    void syncStorefront()
  }, [step, backendLive, syncStorefront])

  async function createAdmin() {
    setCreatingAdmin(true)
    setMessage("")
    const res = await fetch(`/api/projects/${projectId}/admin`, { method: "POST" })
    setCreatingAdmin(false)
    if (res.ok) {
      const data = await res.json()
      setAdminCredentials(data.credentials ?? adminCredentials)
      setMessageType("success")
      setMessage(data.message ?? "Admin user created.")
    } else {
      const data = await res.json().catch(() => ({}))
      setMessageType("error")
      setMessage(data.error ?? "Failed to create admin user")
    }
  }

  async function saveEnv() {
    setSavingEnv(true)
    setMessage("")
    const res = await fetch(`/api/projects/${projectId}/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: envValues }),
    })
    setSavingEnv(false)
    if (res.ok) {
      const data = await res.json()
      setEnvValues(data.values ?? envValues)
      setAutoValues(data.autoValues ?? autoValues)
      setSyncMissing(data.missing ?? [])
      setMessageType("success")
      setMessage("Backend credentials saved. Storefront env updated automatically.")
    } else {
      setMessageType("error")
      setMessage("Failed to save credentials")
    }
  }

  const localStopping = localRun?.status === "stopping"
  const showStop =
    localRun != null &&
    (localRun.status !== "stopped" || backendLive || storefrontLive)
  const localBusy =
    !backendLive &&
    !storefrontLive &&
    (localRun?.status === "starting" ||
      localRun?.workerStatus === "starting" ||
      localStopping ||
      Boolean(activeJobId)) &&
    localRun?.status !== "error"
  const startHoldReason = localRun?.hold?.holdReason
  const startElapsed = localRun?.hold?.elapsedMs ? formatElapsed(localRun.hold.elapsedMs) : null

  useEffect(() => {
    if (!logsModal || logsModal.kind === "seed") return
    if (!localBusy) return
    const t = setInterval(() => void loadLocal(), 1000)
    return () => clearInterval(t)
  }, [logsModal, localBusy, loadLocal])

  const statusBadge =
    localStopping
      ? "pending"
      : storefrontLive
        ? "ready"
        : backendLive
          ? "ready"
          : localRun?.status === "error"
            ? "error"
            : localBusy
              ? "pending"
              : "pending"
  const groupedFields = envFields.reduce<Record<string, EnvField[]>>((acc, f) => {
    ;(acc[f.group] ??= []).push(f)
    return acc
  }, {})

  return (
    <div className="setup-wizard">
      <nav className="setup-wizard-steps" aria-label="Setup steps">
        <button
          type="button"
          className={`setup-step ${step === "backend" ? "setup-step-active" : ""}`}
          onClick={() => setStep("backend")}
        >
          <span className="setup-step-num">1</span>
          <span className="setup-step-text">
            <strong>Backend</strong>
            <small>Local run &amp; credentials</small>
          </span>
        </button>
        <span className="setup-step-divider" aria-hidden />
        <button
          type="button"
          className={`setup-step ${step === "storefront" ? "setup-step-active" : ""} ${!backendLive ? "setup-step-disabled" : ""}`}
          onClick={() => backendLive && setStep("storefront")}
          disabled={!backendLive}
          title={backendLive ? undefined : "Start the backend locally first"}
        >
          <span className="setup-step-num">2</span>
          <span className="setup-step-text">
            <strong>Storefront</strong>
            <small>Auto-connected & section builder</small>
          </span>
        </button>
      </nav>

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-error" : "alert-success"}`}
          style={{ marginBottom: "1rem", fontSize: "0.85rem" }}
        >
          {message}
        </div>
      )}

      {step === "backend" && (
        <>
          <div className="card setup-card">
            <div className="setup-card-header">
              <h2>Local infrastructure</h2>
              <span className={`badge badge-${statusBadge}`}>{displayStatus}</span>
            </div>
            <p className="setup-muted">
              Uses shared Postgres (<code>localhost:5433</code>), Redis (<code>localhost:6380</code>), and
              Mailpit SMTP (<code>localhost:1125</code>). Database: <code>shop_{shopSlug}</code>
            </p>
            {workerOnline === false && (
              <div className="alert alert-error" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                Background worker is offline. Run local jobs need{" "}
                <code>pnpm dev:worker</code> in a second terminal (or use <code>pnpm dev</code> to start web
                + worker together).
              </div>
            )}
            {workerOnline === true && (
              <p className="setup-status-line" style={{ color: "#16a34a" }}>
                Worker online
              </p>
            )}
            {localRun?.message && <p className="setup-status-line">{localRun.message}</p>}
            {localBusy && startHoldReason && (
              <div
                className={`alert ${localRun?.hold?.stalled ? "alert-error" : "alert-success"}`}
                style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}
              >
                {startElapsed && <span>{startElapsed} — </span>}
                {startHoldReason}
                {localRun?.hold?.suggestAction === "retry" && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="btn btn-secondary setup-inline-btn"
                      onClick={() => runLocal("stop").then(() => runLocal("start"))}
                      disabled={runningAction}
                    >
                      Stop &amp; retry
                    </button>
                  </>
                )}
              </div>
            )}
            <LocalRunStatusPanel localRun={localRun} />
            {jobHint && (
              <div className="alert alert-error" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                {jobHint}
              </div>
            )}
            <div className="setup-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={runningAction || backendLive || localBusy}
                onClick={() => runLocal("start")}
              >
                {runningAction ? "Queuing…" : localBusy ? "Starting…" : "Run backend"}
              </button>
              {showStop && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={runningAction || localStopping}
                  onClick={() => runLocal("stop")}
                >
                  {localStopping ? "Stopping…" : "Stop"}
                </button>
              )}
              {backendLive && (
                <a
                  href={medusaAdminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Open admin ↗
                </a>
              )}
            </div>

            {(localBusy || localLogs.length > 0 || localRun?.status === "error") && (
              <div className="setup-process-links">
                <ViewLogsButton
                  onClick={() => openProcessLogs("backend")}
                  label={localBusy ? "View live logs" : "View logs"}
                />
                {localBusy && startElapsed && (
                  <span className="setup-muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
                    {startElapsed} elapsed
                  </span>
                )}
              </div>
            )}
          </div>

          {backendLive && adminCredentials && (
            <div className="card setup-card" style={{ marginTop: "1.25rem" }}>
              <div className="setup-card-header">
                <h2>Medusa admin</h2>
              </div>
              <p className="setup-muted">
                Default local admin for <code>shops/{shopSlug}</code>. Run once after migrations — safe to
                run again (updates the same user).
              </p>
              <dl className="setup-auto-list">
                <div className="setup-auto-row">
                  <dt>
                    <span>Email</span>
                    <small>Medusa admin login</small>
                  </dt>
                  <dd>
                    <code>{adminCredentials.email}</code>
                  </dd>
                </div>
                <div className="setup-auto-row">
                  <dt>
                    <span>Password</span>
                    <small>From shop Makefile defaults</small>
                  </dt>
                  <dd>
                    <code>{adminCredentials.password}</code>
                  </dd>
                </div>
              </dl>
              <div className="setup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={creatingAdmin}
                  onClick={createAdmin}
                >
                  {creatingAdmin ? "Creating…" : "Create admin"}
                </button>
              </div>
            </div>
          )}

          <details className="card setup-card setup-collapsible" style={{ marginTop: "1.25rem" }}>
            <summary className="setup-collapsible-summary">
              <span>
                <strong>Backend credentials</strong>
                <small>backend/.env only — secrets for Medusa; DB, Redis, and CORS are automatic</small>
              </span>
            </summary>
            <div className="setup-collapsible-body">
              {loadingEnv ? (
                <p className="setup-muted">Loading…</p>
              ) : (
                <div className="setup-env-groups">
                  {Object.entries(groupedFields).map(([group, fields]) => (
                    <details key={group} className="setup-env-group" open={group === "core"}>
                      <summary>{GROUP_LABELS[group] ?? group}</summary>
                      <div className="setup-env-grid">
                        {fields.map((field) => (
                          <div key={field.key} className="form-group" style={{ margin: 0 }}>
                            <label htmlFor={field.key}>{field.label}</label>
                            <input
                              id={field.key}
                              type={field.secret ? "password" : "text"}
                              value={envValues[field.key] ?? ""}
                              onChange={(e) =>
                                setEnvValues((v) => ({ ...v, [field.key]: e.target.value }))
                              }
                              placeholder={field.secret ? "••••••••" : field.key}
                              autoComplete="off"
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <div className="setup-form-footer">
                <button type="button" className="btn btn-primary" onClick={saveEnv} disabled={savingEnv}>
                  {savingEnv ? "Saving…" : "Save backend credentials"}
                </button>
              </div>
            </div>
          </details>

          <details className="card setup-card setup-collapsible" style={{ marginTop: "1.25rem" }}>
            <summary className="setup-collapsible-summary">
              <span>
                <strong>Plugins &amp; providers</strong>
                <small>Optional — configure installed plugins and module providers</small>
              </span>
            </summary>
            <div className="setup-collapsible-body">
              <BackendPluginsPanel projectId={projectId} />
              <div style={{ height: "1.25rem" }} />
              <BackendProvidersPanel projectId={projectId} />
            </div>
          </details>

          {backendLive && (
            <div className="setup-continue">
              <button type="button" className="btn btn-primary" onClick={() => setStep("storefront")}>
                Continue to storefront →
              </button>
            </div>
          )}
        </>
      )}

      {step === "storefront" && (
        <>
          <div className="card setup-card">
            <div className="setup-card-header">
              <h2>Storefront connection</h2>
              <span className={`badge badge-${storefrontLive ? "ready" : backendLive ? "pending" : "pending"}`}>
                {storefrontLive ? "running" : backendLive ? "backend only" : displayStatus}
              </span>
            </div>
            <p className="setup-muted">
              Review auto-synced values below, then start the storefront when ready. Values are written to{" "}
              <code>shops/{shopSlug}/storefront/.env.local</code>.
            </p>
            <LocalRunStatusPanel localRun={localRun} />
            <div className="setup-actions" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={runningAction || !backendLive || storefrontLive || localBusy}
                onClick={() => runLocal("start-storefront")}
              >
                {runningAction ? "Queuing…" : localBusy ? "Starting…" : "Run storefront"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={syncStorefront}
                disabled={syncing || !backendLive}
              >
                {syncing ? "Syncing…" : "Re-sync from backend"}
              </button>
              {storefrontLive && (
                <a
                  href={`http://localhost:${localRun?.storefrontPort ?? 8000}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Open storefront ↗
                </a>
              )}
            </div>
            {localRun?.message && storefrontLive === false && localBusy && (
              <p className="setup-status-line">{localRun.message}</p>
            )}
            {(localBusy || localLogs.length > 0 || localRun?.status === "error") && (
              <div className="setup-process-links" style={{ marginBottom: "1rem" }}>
                <ViewLogsButton
                  onClick={() => openProcessLogs("storefront")}
                  label={localBusy ? "View live logs" : "View logs"}
                />
                {localBusy && startElapsed && (
                  <span className="setup-muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
                    {startElapsed} elapsed
                  </span>
                )}
              </div>
            )}

            {syncMissing.length > 0 && (
              <div className="alert alert-error" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                {syncMissing.map((m) => (
                  <div key={m}>{m}</div>
                ))}
                {pkNeedsSeed && (
                  <div className="setup-actions" style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className="btn btn-primary setup-inline-btn"
                      onClick={runSeed}
                      disabled={seeding || !backendLive}
                    >
                      {seeding ? "Running seed…" : "Run seed"}
                    </button>
                    {(seeding || seedLogs.length > 0 || seedRun.status !== "idle") && (
                      <ViewLogsButton
                        onClick={() => openProcessLogs("seed")}
                        label={seeding ? "View live seed logs" : "View seed logs"}
                        disabled={false}
                      />
                    )}
                    {seeding && (
                      <span className="setup-muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
                        Seed running — watch logs for progress
                      </span>
                    )}
                    {!seeding && seedRun.status === "completed" && (
                      <span className="setup-muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
                        Last seed: completed
                      </span>
                    )}
                    {!seeding && seedRun.status === "error" && (
                      <span className="setup-muted" style={{ fontSize: "0.8rem", alignSelf: "center", color: "var(--error)" }}>
                        Last seed failed — check logs
                      </span>
                    )}
                    <span className="setup-muted" style={{ fontSize: "0.8rem" }}>
                      or terminal: <code>cd shops/{shopSlug} && npm run seed</code>
                    </span>
                  </div>
                )}
              </div>
            )}

            <dl className="setup-auto-list">
              {autoFields.map((field) => {
                const value = autoValues[field.key] ?? ""
                const isPk = field.key === PUBLISHABLE_KEY
                const pkSynced = isPk && isSyncedPublishableKey(value)
                const isSecret =
                  !isPk && (field.key.includes("KEY") || field.key.includes("SECRET"))
                return (
                  <div key={field.key} className="setup-auto-row">
                    <dt>
                      <span>{field.label}</span>
                      <small>{field.source}</small>
                    </dt>
                    <dd>
                      {isPk ? (
                        <div className="setup-auto-row-actions">
                          {pkSynced ? (
                            <code>{maskSecret(value)}</code>
                          ) : (
                            <span className="setup-muted">
                              Not synced — run seed if no pk_ key exists yet, then sync
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary setup-inline-btn"
                            onClick={runSeed}
                            disabled={seeding || !backendLive}
                          >
                            {seeding ? "Seeding…" : "Run seed"}
                          </button>
                          {(seeding || seedLogs.length > 0) && (
                            <ViewLogsButton
                              onClick={() => openProcessLogs("seed")}
                              label={seeding ? "Live logs" : "Logs"}
                            />
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary setup-inline-btn"
                            onClick={syncStorefront}
                            disabled={syncing || !backendLive}
                          >
                            {syncing ? "Syncing…" : pkSynced ? "Re-sync" : "Sync publishable key"}
                          </button>
                        </div>
                      ) : value ? (
                        <code>{isSecret ? maskSecret(value) : value}</code>
                      ) : (
                        <span className="setup-muted">Not set yet</span>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>

          <div className="card setup-card">
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Build your storefront</h2>
            <p className="setup-muted" style={{ marginBottom: "1rem" }}>
              {storefrontLive
                ? "Backend and storefront are running. Open the visual builder to edit pages, sections, and brand."
                : "Start the storefront above, then open the section builder to edit pages, sections, and brand."}{" "}
              Configs save to <code>pages.config.json</code> in <code>shops/{shopSlug}/storefront/</code>.
            </p>
            <div className="setup-actions">
              <BuilderAccessLink projectId={projectId} className="btn btn-primary">
                Open section builder
              </BuilderAccessLink>
              {storefrontLive && (
                <a
                  href={`http://localhost:${localRun?.storefrontPort ?? 8000}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Open storefront ↗
                </a>
              )}
              <Link href={`/projects/${projectId}/settings`} className="btn btn-secondary">
                Plugin settings
              </Link>
            </div>
          </div>
        </>
      )}

      <ProcessLogsModal
        open={logsModal !== null}
        title={logsModal?.title ?? "Process logs"}
        logs={logsModal?.kind === "seed" ? seedLogs : localLogs}
        live={logsModal?.kind === "seed" ? seeding : Boolean(localBusy)}
        status={
          logsModal?.kind === "seed"
            ? seeding
              ? "running"
              : seedRun.status
            : (localRun?.status ?? "unknown")
        }
        onClose={() => setLogsModal(null)}
      />
    </div>
  )
}
