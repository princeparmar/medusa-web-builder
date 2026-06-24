"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BackendPluginsPanel, BackendProvidersPanel, GithubActionsConfigPanel } from "@/components/settings/BackendConfigPanels"

type Plugin = {
  packageName: string
  displayName: string
  description: string | null
  category: string
  version: string
  latestVersion: string
  medusaResolve: string
  updateAvailable: boolean
}

type PluginsResponse = {
  plugins: Plugin[]
  grouped: Record<string, Plugin[]>
  categories: Record<string, string>
  total: number
}

const CATEGORY_ORDER = [
  "catalog",
  "content",
  "marketing",
  "search",
  "auth",
  "orders",
  "fulfillment",
  "payments",
  "inventory",
  "notifications",
  "analytics",
  "support",
  "channels",
  "i18n",
  "admin",
  "custom",
]

export default function SettingsPage({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [data, setData] = useState<PluginsResponse | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/registry/plugins")
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const orderedCategories = CATEGORY_ORDER.filter((c) => data?.grouped[c]?.length)

  return (
    <main className="container" style={{ paddingTop: "2rem", maxWidth: 960 }}>
      <Link href={`/projects/${projectId}`} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
        ← {projectName}
      </Link>
      <h1 style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>Settings</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        Backend plugins and module providers{data ? ` · ${data.total} available` : ""}
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", margin: "0 0 1rem" }}>Available plugins</h2>

        {!data ? (
          <p style={{ color: "var(--muted)" }}>Loading plugins…</p>
        ) : data.total === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No plugins registered yet. Your administrator can add them from the admin panel.
          </p>
        ) : (
          orderedCategories.map((category) => (
            <div key={category} style={{ marginBottom: "1.5rem" }}>
              <h3
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--muted)",
                  marginBottom: "0.5rem",
                }}
              >
                {data.categories[category] ?? category} ({data.grouped[category].length})
              </h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {data.grouped[category].map((p) => (
                  <div
                    key={p.packageName}
                    style={{
                      padding: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <div>
                        <strong style={{ fontSize: "0.875rem" }}>{p.displayName}</strong>
                        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.2rem 0" }}>
                          {p.packageName}
                        </p>
                        {p.description && (
                          <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>{p.description}</p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        v{p.version}
                        {p.updateAvailable && <div style={{ color: "var(--accent)" }}>update available</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Backend plugins in use</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Enable plugins and configure their settings for this shop.
        </p>
        <BackendPluginsPanel projectId={projectId} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Module providers</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Enable payment, shipping, and other providers for this shop.
        </p>
        <BackendProvidersPanel projectId={projectId} />
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Cloud secrets &amp; variables</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Manage secrets and variables used when uploading your shop to the cloud.
        </p>
        <GithubActionsConfigPanel projectId={projectId} />
      </div>
    </main>
  )
}
