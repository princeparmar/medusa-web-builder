"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { storefrontPreviewUrl } from "@/lib/storefront-preview-url"

type LocalRunState = {
  status: string
  storefrontPort: number
  message?: string
}

type StorefrontLivePreviewProps = {
  projectId: string
  route: string
  /** Increment after pages.config.json is saved + storefront rebuilt */
  previewSaveToken?: number
}

export function StorefrontLivePreview({
  projectId,
  route,
  previewSaveToken = 0,
}: StorefrontLivePreviewProps) {
  const [localRun, setLocalRun] = useState<LocalRunState | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  const loadLocal = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/local`)
    if (res.ok) setLocalRun(await res.json())
  }, [projectId])

  useEffect(() => {
    loadLocal()
    const t = setInterval(loadLocal, 5000)
    return () => clearInterval(t)
  }, [loadLocal])

  useEffect(() => {
    if (previewSaveToken > 0) setIframeKey((k) => k + 1)
  }, [previewSaveToken, route])

  const port = localRun?.storefrontPort ?? 8000
  const previewUrl = storefrontPreviewUrl(port, route)
  const isRunning = localRun?.status === "running"

  if (!isRunning) {
    return (
      <div className="builder-storefront-placeholder">
        <p className="builder-storefront-placeholder-title">Local storefront not running</p>
        <p className="builder-storefront-placeholder-text">
          Start the shop from setup (Run local) so the builder can show your real{" "}
          <code>npm run dev</code> storefront here.
        </p>
        <div className="builder-storefront-placeholder-actions">
          <Link href={`/projects/${projectId}`} className="btn btn-primary">
            Open shop setup
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => loadLocal()}>
            Check again
          </button>
        </div>
        {localRun?.message && (
          <p className="builder-storefront-placeholder-status">{localRun.message}</p>
        )}
      </div>
    )
  }

  return (
    <div className="builder-storefront-live">
      <div className="builder-storefront-live-bar">
        <span className="builder-storefront-live-dot" aria-hidden />
        <span className="builder-storefront-live-label">Live from local dev server</span>
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="builder-inline-link">
          Open ↗
        </a>
        <button
          type="button"
          className="builder-inline-link"
          onClick={() => setIframeKey((k) => k + 1)}
        >
          Refresh
        </button>
      </div>
      <iframe
        key={iframeKey}
        title="Local storefront preview"
        className="builder-storefront-iframe"
        src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}_t=${iframeKey}`}
      />
    </div>
  )
}
