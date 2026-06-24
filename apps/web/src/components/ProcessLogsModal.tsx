"use client"

import { useEffect, useRef } from "react"

function stripAnsi(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

export function ProcessLogsModal({
  open,
  title,
  logs,
  live,
  status,
  emptyMessage = "No output yet.",
  onClose,
}: {
  open: boolean
  title: string
  logs: string[]
  live?: boolean
  status?: string
  emptyMessage?: string
  onClose: () => void
}) {
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!open) return
    const el = outputRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [open, logs])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const text = logs.length > 0 ? stripAnsi(logs.join("\n")) : live ? "Waiting for output…" : emptyMessage

  return (
    <div className="process-logs-backdrop" role="presentation" onClick={onClose}>
      <div
        className="process-logs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="process-logs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="process-logs-dialog-header">
          <div>
            <h2 id="process-logs-title">{title}</h2>
            {status && (
              <p className="setup-muted" style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
                Status: {status}
              </p>
            )}
          </div>
          <div className="process-logs-dialog-actions">
            {live && <span className="setup-log-live">live</span>}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <pre ref={outputRef} className="process-logs-output" aria-live="polite">
          {text}
        </pre>
      </div>
    </div>
  )
}

export function ViewLogsButton({
  onClick,
  disabled,
  label = "View logs",
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button type="button" className="btn btn-secondary setup-inline-btn" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}
