"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type LocalRunState = {
  status: string
  message?: string
}

type BuilderAccessLinkProps = {
  projectId: string
  className?: string
  children: React.ReactNode
  /** Nav-style text link vs button */
  variant?: "link" | "button"
}

export function BuilderAccessLink({
  projectId,
  className,
  children,
  variant = "button",
}: BuilderAccessLinkProps) {
  const [localRun, setLocalRun] = useState<LocalRunState | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/local`)
    if (res.ok) setLocalRun(await res.json())
  }, [projectId])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const running = localRun?.status === "running"
  const title = running
    ? undefined
    : "Start the storefront locally (step 2 on Setup) before opening the builder."

  if (running) {
    return (
      <Link href={`/projects/${projectId}/builder`} className={className} title={title}>
        {children}
      </Link>
    )
  }

  if (variant === "link") {
    return (
      <span className="builder-access-disabled" title={title} style={{ color: "var(--muted)", cursor: "not-allowed" }}>
        {children}
      </span>
    )
  }

  return (
    <button type="button" className={className} disabled title={title} style={{ opacity: 0.55, cursor: "not-allowed" }}>
      {children}
    </button>
  )
}
