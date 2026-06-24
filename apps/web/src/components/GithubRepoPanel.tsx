"use client"

import { useCallback, useEffect, useState } from "react"

type GithubStatus = {
  configured: boolean
  installed: boolean
  installUrl: string
  availableInstallations: Array<{ login: string; type: string }>
  installationError: string | null
  linked: boolean
  githubRepo: string | null
  githubRepoId: number | null
  expectedRepo: string
  orgUrl: string
  errorMessage?: string | null
}

type JobStatus = {
  state: string
  error?: string | null
  failedReason?: string | null
}

export function GithubRepoPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GithubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [provisioning, setProvisioning] = useState(false)
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/github`)
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!status || status.linked) return
    if (status.installationError) {
      setMessage(status.installationError)
      setIsError(true)
    }
  }, [status])

  const canProvision = status?.configured && status?.installed && !status?.linked

  async function pollProvisionJob(jobId: string) {
    const deadline = Date.now() + 120_000
    const tick = async () => {
      const [jobRes, githubRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/jobs/${jobId}`),
        fetch(`/api/projects/${projectId}/github`),
      ])

      const job = (await jobRes.json().catch(() => ({}))) as JobStatus
      const github = (await githubRes.json().catch(() => ({}))) as GithubStatus

      if (github.linked && github.githubRepo) {
        setProvisioning(false)
        setIsError(false)
        setMessage(`Cloud backup ready: ${github.githubRepo}`)
        window.location.reload()
        return
      }

      if (job.state === "failed" || job.error) {
        setProvisioning(false)
        setIsError(true)
        setMessage(
          job.error ??
            job.failedReason ??
            github.errorMessage ??
            github.installationError ??
            "Could not set up cloud backup"
        )
        await load()
        return
      }

      const err = github.errorMessage ?? github.installationError
      if (err && !github.linked) {
        setProvisioning(false)
        setIsError(true)
        setMessage(err)
        return
      }

      if (Date.now() < deadline) {
        setTimeout(tick, 2500)
      } else {
        setProvisioning(false)
        setIsError(true)
        setMessage(
          "Timed out waiting for cloud backup. Check that the background worker is running."
        )
      }
    }

    setTimeout(tick, 2000)
  }

  async function provision() {
    setProvisioning(true)
    setMessage("")
    setIsError(false)

    const res = await fetch(`/api/projects/${projectId}/github`, { method: "POST" })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setProvisioning(false)
      setIsError(true)
      const parts = [data.error ?? "Could not start cloud backup setup"]
      if (data.hint) parts.push(data.hint)
      setMessage(parts.join("\n\n"))
      return
    }

    setMessage("Setting up cloud backup…")
    if (data.jobId) {
      await pollProvisionJob(data.jobId)
    } else {
      setProvisioning(false)
      setIsError(true)
      setMessage("No background job id returned — is the worker running?")
    }
  }

  if (loading || !status) return null

  if (status.linked && status.githubRepo) {
    return (
      <a
        href={`https://github.com/${status.githubRepo}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: "0.8125rem" }}
      >
        {status.githubRepo}
      </a>
    )
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
        No cloud backup yet
        {!status.configured && " — online storage is not configured on this server"}
        {status.configured && !status.installed && " — connect your online storage account first"}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
        Backup name: <code>{status.expectedRepo}</code>
      </p>

      {status.configured && !status.installed && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>
            {status.installationError ??
              "Connect online storage for this shop before uploading changes."}
          </p>
          {status.availableInstallations.length > 0 && (
            <p style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}>
              Currently installed on:{" "}
              {status.availableInstallations.map((a) => `${a.login} (${a.type})`).join(", ")}
            </p>
          )}
          <a
            href={status.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", display: "inline-flex" }}
          >
            Connect online storage →
          </a>
        </div>
      )}

      {message && (
        <div
          className={isError ? "alert alert-error" : "alert alert-success"}
          style={{ marginBottom: "0.75rem", fontSize: "0.8rem", whiteSpace: "pre-wrap" }}
        >
          {message}
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        style={{ fontSize: "0.75rem" }}
        onClick={provision}
        disabled={provisioning || !canProvision}
      >
        {provisioning ? "Setting up…" : "Set up cloud backup"}
      </button>

      {!status.configured && (
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem", maxWidth: 480 }}>
          Ask your administrator to configure online storage, then restart the app.
        </p>
      )}
    </div>
  )
}
