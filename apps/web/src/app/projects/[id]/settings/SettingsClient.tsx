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
  githubRepo: string
  updateAvailable: boolean
}

type PluginsResponse = {
  plugins: Plugin[]
  grouped: Record<string, Plugin[]>
  categories: Record<string, string>
  sources: Array<{ githubRepo: string; branch: string; displayName: string | null }>
  total: number
  sourceRepo: string
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
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/registry/plugins")
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function syncPlugins() {
    setSyncing(true)
    setMessage("")
    const res = await fetch("/api/registry/sync", { method: "POST" })
    setSyncing(false)
    setMessage(res.ok ? "Sync queued — refresh in a few seconds" : "Sync failed")
    setTimeout(load, 3000)
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => data?.grouped[c]?.length)

  return (
    <main className="container" style={{ paddingTop: "2rem", maxWidth: 960 }}>
      <Link href={`/projects/${projectId}`} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
        ← {projectName}
      </Link>
      <h1 style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>Settings</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        Medusa backend plugins from{" "}
        {data?.sourceRepo ? (
          <a href={data.sourceRepo} target="_blank" rel="noopener noreferrer">
            medusa-plugins
          </a>
        ) : (
          "medusa-plugins"
        )}
        {data ? ` · ${data.total} plugins` : ""}
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Available plugins</h2>
          <button type="button" className="btn btn-secondary" style={{ fontSize: "0.75rem" }} onClick={syncPlugins} disabled={syncing}>
            {syncing ? "Syncing…" : "↻ Sync from repo"}
          </button>
        </div>
        {message && <div className="alert alert-success" style={{ marginBottom: "1rem", fontSize: "0.8rem" }}>{message}</div>}

        {!data ? (
          <p style={{ color: "var(--muted)" }}>Loading plugins…</p>
        ) : data.total === 0 ? (
          <p style={{ color: "var(--muted)" }}>No plugins in registry. Click Sync from repo.</p>
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
          Plugins from <code>backend/plugins.config.json</code> with installed version, registry latest, and
          per-field storage (hardcoded / GitHub variable / GitHub secret).
        </p>
        <BackendPluginsPanel projectId={projectId} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Module providers</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Enable providers in <code>backend/modules.config.json</code> and configure values from each
          provider&apos;s settings schema.
        </p>
        <BackendProvidersPanel projectId={projectId} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>GitHub secrets &amp; variables</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Manage repository Actions secrets and variables used at build/deploy time.
        </p>
        <GithubActionsConfigPanel projectId={projectId} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Register custom plugin repo</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Add plugins from another GitHub monorepo. Supports flat layout, <code>packages/</code>, or{" "}
          <code>plugins/</code> folders — each directory with a <code>package.json</code> is imported.
        </p>
        {data?.sources && data.sources.length > 0 && (
          <div style={{ marginBottom: "1rem", fontSize: "0.8rem" }}>
            <strong>Registered sources</strong>
            {data.sources.map((s) => (
              <div key={s.githubRepo} style={{ color: "var(--muted)", marginTop: "0.25rem" }}>
                {s.displayName ?? s.githubRepo} · {s.githubRepo} ({s.branch})
              </div>
            ))}
          </div>
        )}
        <RegisterPluginRepoForm onRegistered={load} />
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Register custom section repo</h2>
        <RegisterSectionRepoForm />
      </div>
    </main>
  )
}

function RegisterPluginRepoForm({ onRegistered }: { onRegistered: () => void }) {
  const [githubRepo, setGithubRepo] = useState("")
  const [branch, setBranch] = useState("main")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    const res = await fetch("/api/registry/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubRepo, branch }),
    })
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setMessage(body.error ?? "Failed to register plugin repo")
      return
    }
    setMessage("Plugin repo sync queued — refresh in a few seconds")
    setGithubRepo("")
    setTimeout(onRegistered, 4000)
  }

  return (
    <form onSubmit={submit}>
      {message && (
        <div
          className={message.includes("Failed") ? "alert alert-error" : "alert alert-success"}
          style={{ marginBottom: "1rem", fontSize: "0.8rem" }}
        >
          {message}
        </div>
      )}
      <div className="form-group">
        <label>GitHub repo URL</label>
        <input
          value={githubRepo}
          onChange={(e) => setGithubRepo(e.target.value)}
          placeholder="https://github.com/org/medusa-plugins"
          required
        />
      </div>
      <div className="form-group">
        <label>Branch</label>
        <input value={branch} onChange={(e) => setBranch(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Registering…" : "Register & sync plugins"}
      </button>
    </form>
  )
}

function RegisterSectionRepoForm() {
  const [githubRepo, setGithubRepo] = useState("")
  const [message, setMessage] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/registry/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubRepo }),
    })
    setMessage(res.ok ? "Section repo registration queued" : "Failed")
  }

  return (
    <form onSubmit={submit}>
      {message && <div className="alert alert-success">{message}</div>}
      <div className="form-group">
        <label>GitHub repo URL</label>
        <input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="https://github.com/org/storefront-components" required />
      </div>
      <button type="submit" className="btn btn-primary">Register</button>
    </form>
  )
}
