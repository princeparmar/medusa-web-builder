"use client"

import { useCallback, useEffect, useState } from "react"

type GithubStatus = {
  configured: boolean
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
    if (status?.errorMessage && !status.linked) {
      setMessage(status.errorMessage)
      setIsError(true)
    }
  }, [status?.errorMessage, status?.linked])

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
        setMessage(`Repository ready: ${github.githubRepo}`)
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
            "Failed to create GitHub repository"
        )
        await load()
        return
      }

      if (github.errorMessage && !github.linked) {
        setProvisioning(false)
        setIsError(true)
        setMessage(github.errorMessage)
        return
      }

      if (Date.now() < deadline) {
        setTimeout(tick, 2500)
      } else {
        setProvisioning(false)
        setIsError(true)
        setMessage(
          "Timed out waiting for GitHub repository. Check worker logs: docker compose -f docker/docker-compose.yml logs worker"
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
      const parts = [data.error ?? "Failed to queue repository creation"]
      if (data.hint) parts.push(data.hint)
      setMessage(parts.join(" — "))
      return
    }

    setMessage("Creating GitHub repository…")
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
        No GitHub repository yet
        {!status.configured && " — GitHub App credentials are not configured on the worker"}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
        Expected: <code>{status.expectedRepo}</code>
      </p>
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
        disabled={provisioning || !status.configured}
      >
        {provisioning ? "Creating repo…" : "Create GitHub repository"}
      </button>
      {!status.configured && (
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem", maxWidth: 480 }}>
          Add <code>GITHUB_APP_ID</code> and <code>GITHUB_APP_PRIVATE_KEY</code> to <code>.env</code>, install the
          GitHub App on{" "}
          <a href={status.orgUrl} target="_blank" rel="noopener noreferrer">
            medusa-storefronts
          </a>
          , then restart the worker.
        </p>
      )}
    </div>
  )
}
