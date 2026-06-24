"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CATEGORY_LABELS, PAGE_ROUTE_LABELS } from "@mwb/registry/catalog-labels"
import { AdminRegistryFilters, matchesSearch } from "@/components/admin/AdminRegistryFilters"

type Section = {
  id: string
  packageName: string
  displayName: string
  version: string
  componentType: string
  category: string | null
  description: string | null
  pageTypes: string[]
  isBuiltin: boolean
}

const PAGE_TYPES = ["/", "/store", "/products", "/cart", "/checkout", "/account", "/orders"]

const emptyForm = {
  packageName: "",
  displayName: "",
  version: "0.1.0",
  componentType: "segment",
  category: "home",
  description: "",
  pageTypes: "/",
  settingsJson: '{\n  "version": "1",\n  "fields": []\n}',
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
          <h1 style={{ marginBottom: "0.25rem" }}>Section packages</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Register storefront sections that appear in the page builder for all shops.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={seedCatalog} disabled={seeding}>
          {seeding ? "Importing…" : "Import starter catalog"}
        </button>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Add section package</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label>Package name</label>
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
              <label>Version</label>
              <input
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
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
            {loading ? "Adding…" : "Add section"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Registered sections</h2>

        <AdminRegistryFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, package, description, or pages…"
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
              label: "Tag",
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
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {filteredSections.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div>
                  <strong>{s.displayName}</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{s.packageName} · v{s.version}</div>
                  {s.description && <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>{s.description}</div>}
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    {s.componentType} · {s.category} · pages: {s.pageTypes.join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.75rem", alignSelf: "start" }}
                  onClick={() => removeSection(s.id, s.displayName)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
