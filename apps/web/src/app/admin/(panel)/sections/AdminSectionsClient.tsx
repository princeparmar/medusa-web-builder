"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CATEGORY_LABELS, PAGE_ROUTE_LABELS } from "@mwb/registry/catalog-labels"
import { AdminRegistryFilters, matchesSearch } from "@/components/admin/AdminRegistryFilters"
import { CatalogMediaPanel, type CatalogMediaItem } from "@/components/admin/CatalogMediaPanel"
import { CatalogVersionsPanel, type CatalogVersionItem } from "@/components/admin/CatalogVersionsPanel"

type Section = {
  id: string
  packageName: string
  displayName: string
  version: string
  latestVersion: string | null
  componentType: string
  category: string | null
  tags: string[]
  description: string | null
  homepageUrl: string | null
  githubRepo: string | null
  pageTypes: string[]
  isBuiltin: boolean
  settingsSchemaJson?: unknown
  versions?: CatalogVersionItem[]
  media?: CatalogMediaItem[]
}

type EditForm = {
  displayName: string
  description: string
  homepageUrl: string
  githubRepo: string
  tags: string
  category: string
  componentType: string
  pageTypes: string
  settingsJson: string
}

const PAGE_TYPES = ["/", "/store", "/products", "/cart", "/checkout", "/account", "/orders"]

const emptyForm = {
  packageName: "",
  displayName: "",
  version: "0.1.0",
  componentType: "segment",
  category: "home",
  description: "",
  homepageUrl: "",
  githubRepo: "",
  tags: "",
  pageTypes: "/",
  settingsJson: '{\n  "version": "1",\n  "fields": []\n}',
}

function formatSettingsJson(schema: unknown): string {
  if (!schema) return '{\n  "version": "1",\n  "fields": []\n}'
  return JSON.stringify(schema, null, 2)
}

export default function AdminSectionsClient() {
  const [sections, setSections] = useState<Section[]>([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("all")
  const [pageFilter, setPageFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Section | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [addingVersionId, setAddingVersionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/sections")
    if (res.ok) {
      const data = await res.json()
      setSections(data.sections ?? [])
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

    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageName: form.packageName,
        displayName: form.displayName,
        version: form.version,
        componentType: form.componentType,
        category: form.category,
        description: form.description || undefined,
        homepageUrl: form.homepageUrl || undefined,
        githubRepo: form.githubRepo || undefined,
        tags: form.tags,
        pageTypes: form.pageTypes.split(",").map((s) => s.trim()).filter(Boolean),
        settingsSchemaJson,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? "Could not add section")
      return
    }

    setMessage(`Added ${data.displayName}`)
    setForm(emptyForm)
    await load()
  }

  async function removeSection(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the catalog?`)) return
    await fetch(`/api/admin/sections/${id}`, { method: "DELETE" })
    if (expandedId === id) setExpandedId(null)
    if (editing?.id === id) setEditing(null)
    await load()
  }

  function openEdit(section: Section) {
    setEditing(section)
    setEditForm({
      displayName: section.displayName,
      description: section.description ?? "",
      homepageUrl: section.homepageUrl ?? "",
      githubRepo: section.githubRepo ?? "",
      tags: (section.tags ?? []).join(", "),
      category: section.category ?? "custom",
      componentType: section.componentType,
      pageTypes: section.pageTypes.join(", "),
      settingsJson: formatSettingsJson(section.settingsSchemaJson),
    })
    setExpandedId(section.id)
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

    const res = await fetch(`/api/admin/sections/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: editForm.displayName,
        description: editForm.description || null,
        homepageUrl: editForm.homepageUrl || null,
        githubRepo: editForm.githubRepo || null,
        tags: editForm.tags,
        category: editForm.category,
        componentType: editForm.componentType,
        pageTypes: editForm.pageTypes.split(",").map((s) => s.trim()).filter(Boolean),
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

  async function addVersion(sectionId: string, version: string, notes?: string) {
    setAddingVersionId(sectionId)
    setError("")
    const res = await fetch(`/api/admin/sections/${sectionId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, notes }),
    })
    const data = await res.json().catch(() => ({}))
    setAddingVersionId(null)
    if (!res.ok) {
      throw new Error(data.error ?? "Could not add version")
    }
    setMessage(`Registered version ${version}`)
    await load()
  }

  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      if (typeFilter !== "all" && s.componentType !== typeFilter) return false
      if (tagFilter !== "all" && (s.category ?? "custom") !== tagFilter) return false
      if (pageFilter !== "all" && !s.pageTypes.includes(pageFilter)) return false
      const tagLabel = CATEGORY_LABELS[s.category as keyof typeof CATEGORY_LABELS] ?? s.category
      const pageLabels = s.pageTypes.map((p) => PAGE_ROUTE_LABELS[p] ?? p).join(" ")
      return matchesSearch(search, [
        s.displayName,
        s.packageName,
        s.description,
        s.componentType,
        tagLabel,
        pageLabels,
        s.pageTypes.join(" "),
        ...(s.tags ?? []),
        s.githubRepo,
        s.homepageUrl,
      ])
    })
  }, [sections, typeFilter, tagFilter, pageFilter, search])

  const hasActiveFilters =
    search.trim() !== "" || typeFilter !== "all" || tagFilter !== "all" || pageFilter !== "all"

  function clearFilters() {
    setSearch("")
    setTypeFilter("all")
    setTagFilter("all")
    setPageFilter("all")
  }

  function handleFilterChange(id: string, value: string) {
    if (id === "type") setTypeFilter(value)
    if (id === "tag") setTagFilter(value)
    if (id === "page") setPageFilter(value)
  }

  const tagOptions = useMemo(
    () => [
      { value: "all", label: "All tags" },
      ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    ],
    []
  )

  const pageOptions = useMemo(
    () => [
      { value: "all", label: "All pages" },
      ...PAGE_TYPES.map((route) => ({
        value: route,
        label: PAGE_ROUTE_LABELS[route] ?? route,
      })),
    ],
    []
  )

  return (
    <main className="container" style={{ padding: "2rem 0 3rem", maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>UI components</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Register published npm section packages for the page builder. Version must exist on npm.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={seedCatalog} disabled={seeding}>
          {seeding ? "Importing…" : "Import starter catalog"}
        </button>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Add UI component package</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label>Package name (npm)</label>
              <input
                value={form.packageName}
                onChange={(e) => setForm((f) => ({ ...f, packageName: e.target.value }))}
                placeholder="@pradip1995/segment-hero"
                required
              />
            </div>
            <div className="form-group">
              <label>Display name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Hero banner"
                required
              />
            </div>
            <div className="form-group">
              <label>Version (published on npm)</label>
              <input
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={form.componentType}
                onChange={(e) => setForm((f) => ({ ...f, componentType: e.target.value }))}
              >
                <option value="segment">Section</option>
                <option value="layout">Layout</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Page routes (comma-separated)</label>
              <input
                value={form.pageTypes}
                onChange={(e) => setForm((f) => ({ ...f, pageTypes: e.target.value }))}
                placeholder={PAGE_TYPES.join(", ")}
              />
            </div>
            <div className="form-group">
              <label>Homepage link</label>
              <input
                value={form.homepageUrl}
                onChange={(e) => setForm((f) => ({ ...f, homepageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="form-group">
              <label>GitHub URL</label>
              <input
                value={form.githubRepo}
                onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))}
                placeholder="https://github.com/org/repo"
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="hero, banner, jewelry"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description for shop owners"
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
            {loading ? "Adding…" : "Add UI component"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Registered UI components</h2>

        <AdminRegistryFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, package, description, tags…"
          filters={[
            {
              id: "type",
              label: "Type",
              value: typeFilter,
              options: [
                { value: "all", label: "All types" },
                { value: "segment", label: "Section" },
                { value: "layout", label: "Layout" },
              ],
            },
            {
              id: "tag",
              label: "Category",
              value: tagFilter,
              options: tagOptions,
            },
            {
              id: "page",
              label: "Page",
              value: pageFilter,
              options: pageOptions,
            },
          ]}
          onFilterChange={handleFilterChange}
          onClear={clearFilters}
          filteredCount={filteredSections.length}
          totalCount={sections.length}
          hasActiveFilters={hasActiveFilters}
        />

        {sections.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No sections yet. Add one above or import the starter catalog.</p>
        ) : filteredSections.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No sections match your filters.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredSections.map((s) => {
              const isExpanded = expandedId === s.id
              const isEditing = editing?.id === s.id

              return (
                <div
                  key={s.id}
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
                      <strong>{s.displayName}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                        {s.packageName} · v{s.version}
                        {s.latestVersion && s.latestVersion !== s.version ? ` · latest v${s.latestVersion}` : ""}
                      </div>
                      {s.description && (
                        <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>{s.description}</div>
                      )}
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        {s.componentType} · {s.category}
                        {(s.tags ?? []).length > 0 ? ` · tags: ${s.tags.join(", ")}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem" }}
                        onClick={() => removeSection(s.id, s.displayName)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isExpanded && !isEditing && (
                    <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
                      <dl
                        style={{
                          display: "grid",
                          gridTemplateColumns: "140px 1fr",
                          gap: "0.375rem 1rem",
                          fontSize: "0.8125rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <dt style={{ color: "var(--muted)" }}>Package</dt>
                        <dd style={{ margin: 0, wordBreak: "break-all" }}>{s.packageName}</dd>
                        <dt style={{ color: "var(--muted)" }}>Homepage</dt>
                        <dd style={{ margin: 0 }}>
                          {s.homepageUrl ? (
                            <a href={s.homepageUrl} target="_blank" rel="noreferrer">
                              {s.homepageUrl}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                        <dt style={{ color: "var(--muted)" }}>GitHub</dt>
                        <dd style={{ margin: 0 }}>
                          {s.githubRepo ? (
                            <a href={s.githubRepo} target="_blank" rel="noreferrer">
                              {s.githubRepo}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                        <dt style={{ color: "var(--muted)" }}>Pages</dt>
                        <dd style={{ margin: 0 }}>{s.pageTypes.join(", ") || "—"}</dd>
                      </dl>
                      <CatalogVersionsPanel
                        versions={s.versions ?? []}
                        pinnedVersion={s.version}
                        latestVersion={s.latestVersion}
                        adding={addingVersionId === s.id}
                        onAddVersion={(version, notes) => addVersion(s.id, version, notes)}
                      />
                      <CatalogMediaPanel
                        kind="SECTION"
                        registryId={s.id}
                        media={s.media ?? []}
                        onChanged={load}
                      />
                    </div>
                  )}

                  {isEditing && editForm && (
                    <form
                      onSubmit={saveEdit}
                      style={{ padding: "0 0.75rem 0.75rem", borderTop: "1px solid var(--border)" }}
                    >
                      <h3 style={{ fontSize: "0.875rem", margin: "0.75rem 0" }}>Edit {s.displayName}</h3>
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
                          <label>Category</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => f && { ...f, category: e.target.value })}
                          >
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Homepage link</label>
                          <input
                            value={editForm.homepageUrl}
                            onChange={(e) => setEditForm((f) => f && { ...f, homepageUrl: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>GitHub URL</label>
                          <input
                            value={editForm.githubRepo}
                            onChange={(e) => setEditForm((f) => f && { ...f, githubRepo: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                          <label>Tags</label>
                          <input
                            value={editForm.tags}
                            onChange={(e) => setEditForm((f) => f && { ...f, tags: e.target.value })}
                          />
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
                          rows={10}
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
