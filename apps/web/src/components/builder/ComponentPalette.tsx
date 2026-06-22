"use client"

import { useCallback, useEffect, useState } from "react"
import { CATEGORY_LABELS, PAGE_ROUTE_LABELS, ROUTE_CATEGORY } from "@mwb/registry/catalog-labels"
import { isLayoutShellPackage } from "@mwb/registry/layout-shell"

export type RegistrySection = {
  packageName: string
  displayName: string
  description: string | null
  componentType: string
  category: string | null
  version: string
  latestVersion: string | null
  installedVersion: string | null
  updateAvailable: boolean
  githubRepo: string | null
  pageTypes: string[]
  settingsSchemaJson?: Record<string, unknown>
  isBuiltin: boolean
}

type RegistryResponse = {
  sections: RegistrySection[]
  sources: Array<{ githubRepo: string; branch: string; displayName: string | null }>
  storefrontComponentsRepo: string
}

const CATEGORY_ORDER = [
  "home",
  "store",
  "product",
  "cart",
  "checkout",
  "account",
  "orders",
  "custom",
]

function isPageSection(s: RegistrySection): boolean {
  return s.componentType !== "layout" && !isLayoutShellPackage(s.packageName)
}

export function ComponentPalette({
  projectId,
  activeRoute,
  onAdd,
  usedPackages,
}: {
  projectId: string
  activeRoute: string
  onAdd: (packageName: string) => void
  usedPackages: string[]
}) {
  const [sections, setSections] = useState<RegistrySection[]>([])
  const [allSections, setAllSections] = useState<RegistrySection[]>([])
  const [sources, setSources] = useState<RegistryResponse["sources"]>([])
  const [storefrontRepo, setStorefrontRepo] = useState("")
  const [tab, setTab] = useState<"page" | "all" | "sources">("page")
  const [githubRepo, setGithubRepo] = useState("")
  const [branch, setBranch] = useState("main")
  const [message, setMessage] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const loadRegistry = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/registry?pageType=${encodeURIComponent(activeRoute)}`
    )
    if (!res.ok) return
    const data: RegistryResponse = await res.json()
    setSections(data.sections)
    setSources(data.sources)
    setStorefrontRepo(data.storefrontComponentsRepo)

    const allRes = await fetch(`/api/projects/${projectId}/registry?all=true`)
    if (allRes.ok) {
      const allData: RegistryResponse = await allRes.json()
      setAllSections(allData.sections)
    }
  }, [projectId, activeRoute])

  useEffect(() => {
    loadRegistry()
  }, [loadRegistry])

  async function syncCatalog() {
    setSyncing(true)
    setMessage("")
    const res = await fetch("/api/registry/sync", { method: "POST" })
    setSyncing(false)
    setMessage(res.ok ? "Sync queued — refresh in a few seconds" : "Sync failed")
    setTimeout(loadRegistry, 3000)
  }

  async function registerRepo(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    const res = await fetch("/api/registry/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubRepo, branch }),
    })
    setMessage(res.ok ? "Repo sync queued" : "Failed to register repo")
    if (res.ok) {
      setGithubRepo("")
      setTimeout(loadRegistry, 4000)
    }
  }

  async function upgradePackage(packageName: string) {
    setUpgrading(packageName)
    setMessage("")
    const res = await fetch(`/api/projects/${projectId}/registry/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageName }),
    })
    setUpgrading(null)
    if (res.ok) {
      setMessage(`Updated ${packageName} in package.json`)
      loadRegistry()
    } else {
      setMessage("Upgrade failed")
    }
  }

  const pageCategory = ROUTE_CATEGORY[activeRoute]
  const pageLabel = PAGE_ROUTE_LABELS[activeRoute] ?? activeRoute
  const displaySections = (tab === "all" ? allSections : sections).filter(isPageSection)

  const grouped = displaySections.reduce<Record<string, RegistrySection[]>>((acc, s) => {
    const key = s.category ?? "custom"
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const orderedKeys = CATEGORY_ORDER.filter((k) => grouped[k]?.length)

  return (
    <div>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
        {tab === "page"
          ? `Components for ${pageLabel}`
          : tab === "all"
            ? "All storefront components"
            : "Section sources"}
      </p>

      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {(["page", "all", "sources"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.7rem",
              padding: "0.25rem 0.5rem",
              background: tab === t ? "var(--border)" : undefined,
            }}
            onClick={() => setTab(t)}
          >
            {t === "page" ? "This page" : t === "all" ? "All" : "Sources"}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", marginLeft: "auto" }}
          onClick={syncCatalog}
          disabled={syncing}
        >
          {syncing ? "…" : "↻ Sync"}
        </button>
      </div>

      {message && (
        <div className="alert alert-success" style={{ fontSize: "0.7rem", marginBottom: "0.5rem" }}>
          {message}
        </div>
      )}

      {tab === "sources" ? (
        <div style={{ fontSize: "0.75rem" }}>
          <div style={{ marginBottom: "1rem", padding: "0.5rem", background: "var(--surface)", borderRadius: "var(--radius)" }}>
            <strong>Default repo</strong>
            <div style={{ color: "var(--muted)", wordBreak: "break-all" }}>{storefrontRepo}</div>
          </div>
          {sources.map((s) => (
            <div
              key={s.githubRepo}
              style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}
            >
              <div>{s.displayName ?? s.githubRepo}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                {s.githubRepo} ({s.branch})
              </div>
            </div>
          ))}
          <form onSubmit={registerRepo} style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <label style={{ fontSize: "0.7rem" }}>Add GitHub repo</label>
              <input
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="https://github.com/org/my-sections"
                required
                style={{ fontSize: "0.75rem" }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: "0.7rem" }}>Branch</label>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                style={{ fontSize: "0.75rem" }}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ width: "100%", fontSize: "0.75rem" }}>
              Register & sync
            </button>
          </form>
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          {orderedKeys.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              No components for this page. Try Sync or check All tab.
            </p>
          )}
          {orderedKeys.map((key) => (
            <div key={key} style={{ marginBottom: "1rem" }}>
              <h4
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: "0.375rem",
                  letterSpacing: "0.04em",
                }}
              >
                {CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key}
                {tab === "page" && key === pageCategory ? " · matches page" : ""}
              </h4>
              {grouped[key].map((s) => (
                <SectionCard
                  key={s.packageName}
                  section={s}
                  used={usedPackages.includes(s.packageName)}
                  upgrading={upgrading === s.packageName}
                  onAdd={() => onAdd(s.packageName)}
                  onUpgrade={() => upgradePackage(s.packageName)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionCard({
  section,
  used,
  upgrading,
  onAdd,
  onUpgrade,
}: {
  section: RegistrySection
  used: boolean
  upgrading: boolean
  onAdd: () => void
  onUpgrade: () => void
}) {
  const installed = section.installedVersion ?? section.version
  const latest = section.latestVersion ?? section.version

  return (
    <div
      style={{
        padding: "0.5rem",
        marginBottom: "0.375rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        fontSize: "0.75rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <strong>{section.displayName}</strong>
        <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
          {section.componentType}
        </span>
      </div>
      {section.description && (
        <p style={{ color: "var(--muted)", margin: "0.25rem 0", fontSize: "0.7rem" }}>
          {section.description}
        </p>
      )}
      <div style={{ color: "var(--muted)", fontSize: "0.65rem", marginBottom: "0.375rem" }}>
        v{installed}
        {latest !== installed && ` · latest v${latest}`}
      </div>
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.65rem", padding: "0.2rem 0.4rem", flex: 1 }}
          onClick={onAdd}
          disabled={used || section.componentType === "layout"}
          title={section.componentType === "layout" ? "Layouts are set per page in pages.config" : undefined}
        >
          {used ? "Added" : section.componentType === "layout" ? "Layout" : "+ Add"}
        </button>
        {section.updateAvailable && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: "0.65rem", padding: "0.2rem 0.4rem" }}
            onClick={onUpgrade}
            disabled={upgrading}
          >
            {upgrading ? "…" : "Update"}
          </button>
        )}
      </div>
    </div>
  )
}
