"use client"

import { useCallback, useEffect, useState } from "react"

type CommitEntry = {
  sha: string
  message: string
  date: string
  author: string
}

type BranchEntry = {
  name: string
  label: string
  draftId: string | null
  isActive: boolean
  isLive: boolean
}

type VersionsData = {
  ready: boolean
  currentBranch?: string
  activeDraft?: { id: string; name: string; gitBranch: string } | null
  branches: BranchEntry[]
  commits: CommitEntry[]
  cloudConnected: boolean
}

type Props = {
  projectId: string
  activeDraftId: string | null
  onDraftChange: (draftId: string | null) => void
  refreshKey?: number
  onMessage?: (text: string) => void
}

export function VersionsPanel({
  projectId,
  activeDraftId,
  onDraftChange,
  refreshKey = 0,
  onMessage,
}: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<VersionsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/versions`)
    if (res.ok) {
      const json = (await res.json()) as VersionsData
      setData(json)
      if (json.activeDraft?.id) onDraftChange(json.activeDraft.id)
    }
    setLoading(false)
  }, [projectId, onDraftChange])

  useEffect(() => {
    if (open) load()
  }, [open, load, refreshKey])

  async function getLatest() {
    setPulling(true)
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pull" }),
    })
    const json = await res.json().catch(() => ({}))
    setPulling(false)
    onMessage?.(json.message ?? (res.ok ? "Updated from cloud" : "Could not get latest changes"))
    if (res.ok) await load()
  }

  async function switchCopy(draftId: string) {
    setSwitching(draftId)
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch-copy", draftId }),
    })
    const json = await res.json().catch(() => ({}))
    setSwitching(null)
    if (res.ok) {
      onDraftChange(draftId)
      onMessage?.(json.message ?? "Switched working copy")
      await load()
    } else {
      onMessage?.(json.error ?? "Could not switch working copy")
    }
  }

  async function createCopy() {
    const name = window.prompt("Name for this working copy", "My changes")
    if (!name?.trim()) return

    setCreating(true)
    const res = await fetch(`/api/projects/${projectId}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    setCreating(false)
    if (res.ok) {
      const draft = await res.json()
      onDraftChange(draft.id)
      onMessage?.(`Created "${draft.name}"`)
      await load()
    } else {
      onMessage?.("Could not create working copy")
    }
  }

  const activeLabel =
    data?.activeDraft?.name ??
    data?.branches.find((b) => b.isActive)?.label ??
    "Working copy"

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        title="View saved changes and switch working copies"
      >
        Saved changes
      </button>

      {open && (
        <div className="builder-versions-overlay" onClick={() => setOpen(false)}>
          <div
            className="builder-versions-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="versions-panel-title"
          >
            <div className="builder-versions-header">
              <div>
                <h2 id="versions-panel-title">Saved changes</h2>
                <p className="builder-versions-subtitle">
                  Each time you save, a snapshot is recorded. Upload sends your latest save to the cloud.
                </p>
              </div>
              <button type="button" className="builder-versions-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="builder-versions-toolbar">
              <div className="builder-versions-current">
                <span className="builder-versions-label">Working copy</span>
                <strong>{activeLabel}</strong>
                {!data?.cloudConnected && (
                  <span className="builder-versions-hint">Cloud backup not linked</span>
                )}
              </div>
              <div className="builder-versions-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={getLatest}
                  disabled={pulling || !data?.cloudConnected}
                  title={data?.cloudConnected ? "Download the latest from cloud" : "Link cloud backup in project settings first"}
                >
                  {pulling ? "Getting latest…" : "Get latest"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={createCopy}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "New working copy"}
                </button>
              </div>
            </div>

            {data && data.branches.length > 1 && (
              <div className="builder-versions-section">
                <h3>Switch working copy</h3>
                <ul className="builder-versions-branches">
                  {data.branches.map((branch) => (
                    <li key={branch.name}>
                      <button
                        type="button"
                        className={`builder-versions-branch${branch.isActive ? " active" : ""}`}
                        onClick={() => branch.draftId && !branch.isActive && switchCopy(branch.draftId)}
                        disabled={
                          branch.isActive ||
                          !branch.draftId ||
                          switching === branch.draftId
                        }
                      >
                        <span>{branch.label}</span>
                        {branch.isLive && <span className="builder-versions-tag">Live</span>}
                        {branch.isActive && <span className="builder-versions-tag current">Current</span>}
                        {switching === branch.draftId && <span className="builder-versions-tag">Switching…</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="builder-versions-section">
              <h3>History</h3>
              {loading && !data ? (
                <p className="builder-versions-empty">Loading…</p>
              ) : !data?.ready ? (
                <p className="builder-versions-empty">Shop folder not ready yet.</p>
              ) : data.commits.length === 0 ? (
                <p className="builder-versions-empty">
                  No saves yet. Click <strong>Save changes</strong> in the builder to create your first snapshot.
                </p>
              ) : (
                <ul className="builder-versions-commits">
                  {data.commits.map((commit) => (
                    <li key={commit.sha} className="builder-versions-commit">
                      <div className="builder-versions-commit-top">
                        <span className="builder-versions-commit-msg">{commit.message}</span>
                        <time className="builder-versions-commit-date" dateTime={commit.date}>
                          {new Date(commit.date).toLocaleString()}
                        </time>
                      </div>
                      <span className="builder-versions-commit-meta">
                        {commit.author} · {commit.sha}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
