"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminRegistryFilters, matchesSearch } from "@/components/admin/AdminRegistryFilters"

type SettingsField = {
  id: string
  type: string
  label?: string
  description?: string
  required?: boolean
  storage?: string
  envName?: string
}

type SettingsSchema = {
  version: string
  fields: SettingsField[]
  groups?: Array<{ id: string; label: string }>
}

type Plugin = {
  id: string
  packageName: string
  displayName: string
  description: string | null
  version: string
  latestVersion: string | null
  medusaResolve: string
  category: string | null
  isBuiltin: boolean
  githubRepo: string | null
  settingsSchemaJson: SettingsSchema | null
}

type EditForm = {
  displayName: string
  description: string
  version: string
  medusaResolve: string
  category: string
  settingsJson: string
}

const emptyForm = {
  packageName: "",
  displayName: "",
  description: "",
  version: "0.1.0",
  medusaResolve: "",
  category: "catalog",
  settingsJson: '{\n  "version": "1",\n  "fields": []\n}',
}

function formatSettingsJson(schema: SettingsSchema | null): string {
  if (!schema) return '{\n  "version": "1",\n  "fields": []\n}'
  return JSON.stringify(schema, null, 2)
}

function requiredFields(schema: SettingsSchema | null): SettingsField[] {
  return schema?.fields?.filter((f) => f.required) ?? []
}

export default function AdminPluginsClient() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Plugin | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [upgradingId, setUpgradingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [requiredFilter, setRequiredFilter] = useState("all")

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plugins")
    if (res.ok) {
      const data = await res.json()
      setPlugins(data.plugins ?? [])
      setCategories(data.categories ?? {})
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function seedCatalog() {
    setSeeding(true)
    setMessage("")
    const res = await fetch("/api/admin/seed", { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setSeeding(false)
    setMessage(res.ok ? data.message : data.error ?? "Import failed")
    await load()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    let settingsSchemaJson: unknown
    try {
      settingsSchemaJson = JSON.parse(form.settingsJson)
    } catch {
      setLoading(false)
      setError("Settings JSON is invalid")
      return
    }

    const res = await fetch("/api/admin/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageName: form.packageName,
        displayName: form.displayName,
        description: form.description || undefined,
        version: form.version,
        medusaResolve: form.medusaResolve || form.packageName,
        category: form.category,
        settingsSchemaJson,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? "Could not add plugin")
      return
    }

    setMessage(`Added ${data.displayName}`)
    setForm(emptyForm)
    await load()
  }

  async function removePlugin(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the catalog?`)) return
    await fetch(`/api/admin/plugins/${id}`, { method: "DELETE" })
    if (expandedId === id) setExpandedId(null)
    if (editing?.id === id) setEditing(null)
    await load()
  }

  function openEdit(plugin: Plugin) {
    setEditing(plugin)
    setEditForm({
      displayName: plugin.displayName,
      description: plugin.description ?? "",
      version: plugin.version,
      medusaResolve: plugin.medusaResolve,
      category: plugin.category ?? "custom",
      settingsJson: formatSettingsJson(plugin.settingsSchemaJson),
    })
    setExpandedId(plugin.id)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || !editForm) return

    setSavingEdit(true)
    setError("")
    setMessage("")

    let settingsSchemaJson: unknown
    try {
      settingsSchemaJson = JSON.parse(editForm.settingsJson)
    } catch {
      setSavingEdit(false)
      setError("Settings JSON is invalid")
      return
    }

    const res = await fetch(`/api/admin/plugins/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: editForm.displayName,
        description: editForm.description || null,
        version: editForm.version,
        medusaResolve: editForm.medusaResolve,
        category: editForm.category,
        settingsSchemaJson,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSavingEdit(false)
    if (!res.ok) {
      setError(data.error ?? "Could not save changes")
      return
    }

    setMessage(`Updated ${data.displayName}`)
    setEditing(null)
    setEditForm(null)
    await load()
  }

  async function upgradeVersion(plugin: Plugin) {
    const suggested = plugin.latestVersion && plugin.latestVersion !== plugin.version
      ? plugin.latestVersion
      : plugin.version
    const next = window.prompt(`New version for "${plugin.displayName}"`, suggested)
    if (!next?.trim() || next.trim() === plugin.version) return

    setUpgradingId(plugin.id)
    setError("")
    const res = await fetch(`/api/admin/plugins/${plugin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: next.trim(), latestVersion: next.trim() }),
    })
    setUpgradingId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Could not update version")
      return
    }
    setMessage(`Updated ${plugin.displayName} to v${next.trim()}`)
    await load()
  }

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      if (categoryFilter !== "all" && (p.category ?? "custom") !== categoryFilter) return false
      if (sourceFilter === "starter" && !p.isBuiltin) return false
      if (sourceFilter === "manual" && p.isBuiltin) return false
      const reqCount = requiredFields(p.settingsSchemaJson).length
      if (requiredFilter === "required" && reqCount === 0) return false
      if (requiredFilter === "optional" && reqCount > 0) return false
      const categoryLabel = categories[p.category ?? "custom"] ?? p.category
      const settingsText = p.settingsSchemaJson ? JSON.stringify(p.settingsSchemaJson) : ""
      return matchesSearch(search, [
        p.displayName,
        p.packageName,
        p.description,
        p.medusaResolve,
        categoryLabel,
        settingsText,
      ])
    })
  }, [plugins, categoryFilter, sourceFilter, requiredFilter, search, categories])

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    sourceFilter !== "all" ||
    requiredFilter !== "all"

  function clearFilters() {
    setSearch("")
    setCategoryFilter("all")
    setSourceFilter("all")
    setRequiredFilter("all")
  }

  function handleFilterChange(id: string, value: string) {
    if (id === "category") setCategoryFilter(value)
    if (id === "source") setSourceFilter(value)
    if (id === "required") setRequiredFilter(value)
  }

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All tags" },
      ...Object.entries(categories).map(([value, label]) => ({ value, label })),
    ],
    [categories]
  )

  return (
    <main className="container" style={{ padding: "2rem 0 3rem", maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Backend plugins</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Register Medusa plugins that shop owners can enable and configure.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={seedCatalog} disabled={seeding}>
          {seeding ? "Importing…" : "Import starter catalog"}
        </button>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Add plugin package</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label>Package name</label>
              <input
                value={form.packageName}
                onChange={(e) => setForm((f) => ({ ...f, packageName: e.target.value }))}
                placeholder="medusa-contact-us"
                required
              />
            </div>
            <div className="form-group">
              <label>Display name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Contact Us"
                required
              />
            </div>
            <div className="form-group">
              <label>Version</label>
              <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Medusa resolve key</label>
              <input
                value={form.medusaResolve}
                onChange={(e) => setForm((f) => ({ ...f, medusaResolve: e.target.value }))}
                placeholder="Same as package name if empty"
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {Object.entries(categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What this plugin does"
            />
          </div>
          <div className="form-group">
            <label>Settings schema (JSON)</label>
            <textarea
              value={form.settingsJson}
              onChange={(e) => setForm((f) => ({ ...f, settingsJson: e.target.value }))}
              rows={8}
              style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Adding…" : "Add plugin"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Registered plugins</h2>

        <AdminRegistryFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, package, description, or settings…"
          filters={[
            {
              id: "category",
              label: "Tag",
              value: categoryFilter,
              options: categoryOptions,
            },
            {
              id: "source",
              label: "Type",
              value: sourceFilter,
              options: [
                { value: "all", label: "All types" },
                { value: "starter", label: "Starter catalog" },
                { value: "manual", label: "Added manually" },
              ],
            },
            {
              id: "required",
              label: "Configuration",
              value: requiredFilter,
              options: [
                { value: "all", label: "Any fields" },
                { value: "required", label: "Has required fields" },
                { value: "optional", label: "All optional" },
              ],
            },
          ]}
          onFilterChange={handleFilterChange}
          onClear={clearFilters}
          filteredCount={filteredPlugins.length}
          totalCount={plugins.length}
          hasActiveFilters={hasActiveFilters}
        />

        {plugins.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No plugins yet. Add one above or import the starter catalog.</p>
        ) : filteredPlugins.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No plugins match your filters.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredPlugins.map((p) => {
              const isExpanded = expandedId === p.id
              const isEditing = editing?.id === p.id
              const required = requiredFields(p.settingsSchemaJson)

              return (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.75rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{p.displayName}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                        {p.packageName} · v{p.version}
                        {p.latestVersion && p.latestVersion !== p.version ? ` · latest v${p.latestVersion}` : ""}
                      </div>
                      {p.description && (
                        <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>{p.description}</div>
                      )}
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        {categories[p.category ?? "custom"] ?? p.category}
                        {required.length > 0 ? ` · ${required.length} required field(s)` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => upgradeVersion(p)}
                        disabled={upgradingId === p.id}
                      >
                        {upgradingId === p.id ? "…" : "Upgrade version"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => removePlugin(p.id, p.displayName)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isExpanded && !isEditing && (
                    <PluginDetails plugin={p} categories={categories} />
                  )}

                  {isEditing && editForm && (
                    <form onSubmit={saveEdit} style={{ padding: "0 0.75rem 0.75rem", borderTop: "1px solid var(--border)" }}>
                      <h3 style={{ fontSize: "0.875rem", margin: "0.75rem 0" }}>Edit {p.displayName}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div className="form-group">
                          <label>Display name</label>
                          <input
                            value={editForm.displayName}
                            onChange={(e) => setEditForm((f) => f && { ...f, displayName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Version</label>
                          <input
                            value={editForm.version}
                            onChange={(e) => setEditForm((f) => f && { ...f, version: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Medusa resolve key</label>
                          <input
                            value={editForm.medusaResolve}
                            onChange={(e) => setEditForm((f) => f && { ...f, medusaResolve: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Category</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => f && { ...f, category: e.target.value })}
                          >
                            {Object.entries(categories).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => f && { ...f, description: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Settings schema (JSON)</label>
                        <textarea
                          value={editForm.settingsJson}
                          onChange={(e) => setEditForm((f) => f && { ...f, settingsJson: e.target.value })}
                          rows={12}
                          style={{ fontFamily: "monospace", fontSize: "0.8125rem", width: "100%" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditing(null)
                            setEditForm(null)
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function PluginDetails({ plugin, categories }: { plugin: Plugin; categories: Record<string, string> }) {
  const schema = plugin.settingsSchemaJson
  const required = requiredFields(schema)
  const allFields = schema?.fields ?? []

  return (
    <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          gap: "0.375rem 1rem",
          fontSize: "0.8125rem",
          marginBottom: "1rem",
        }}
      >
        <dt style={{ color: "var(--muted)" }}>Package</dt>
        <dd style={{ margin: 0, wordBreak: "break-all" }}>{plugin.packageName}</dd>
        <dt style={{ color: "var(--muted)" }}>Resolve key</dt>
        <dd style={{ margin: 0 }}>{plugin.medusaResolve}</dd>
        <dt style={{ color: "var(--muted)" }}>Version</dt>
        <dd style={{ margin: 0 }}>
          v{plugin.version}
          {plugin.latestVersion && plugin.latestVersion !== plugin.version
            ? ` (latest registered: v${plugin.latestVersion})`
            : ""}
        </dd>
        <dt style={{ color: "var(--muted)" }}>Category</dt>
        <dd style={{ margin: 0 }}>{categories[plugin.category ?? "custom"] ?? plugin.category ?? "—"}</dd>
        <dt style={{ color: "var(--muted)" }}>Source</dt>
        <dd style={{ margin: 0 }}>{plugin.isBuiltin ? "Starter catalog" : "Added manually"}</dd>
      </dl>

      {required.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Required configuration fields
          </h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.375rem 0.5rem", color: "var(--muted)", fontWeight: 500 }}>Field</th>
                <th style={{ padding: "0.375rem 0.5rem", color: "var(--muted)", fontWeight: 500 }}>Type</th>
                <th style={{ padding: "0.375rem 0.5rem", color: "var(--muted)", fontWeight: 500 }}>Storage</th>
              </tr>
            </thead>
            <tbody>
              {required.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.375rem 0.5rem" }}>
                    <strong>{f.label ?? f.id}</strong>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{f.id}</div>
                  </td>
                  <td style={{ padding: "0.375rem 0.5rem", color: "var(--muted)" }}>{f.type}</td>
                  <td style={{ padding: "0.375rem 0.5rem", color: "var(--muted)" }}>
                    {f.storage ?? "hardcoded"}
                    {f.envName ? ` · ${f.envName}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allFields.length > 0 && required.length === 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
          No required fields — all settings are optional ({allFields.length} field(s) total).
        </p>
      )}

      {allFields.length === 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
          No configuration fields defined yet.
        </p>
      )}

      <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>
        Settings schema (JSON)
      </h4>
      <pre
        style={{
          margin: 0,
          padding: "0.75rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: "0.75rem",
          overflow: "auto",
          maxHeight: 320,
        }}
      >
        {formatSettingsJson(schema)}
      </pre>
    </div>
  )
}
