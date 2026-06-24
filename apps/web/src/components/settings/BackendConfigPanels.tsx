"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BuilderSettings } from "@mwb/registry/schemas"
import { PLUGIN_CATEGORY_LABELS } from "@mwb/registry/plugins-catalog"
import type { FieldBinding } from "@mwb/core/builder-config/bindings"
import { hydrateConfigFormState } from "@mwb/core/builder-config/bindings"
import { ConfigFieldForm } from "@/components/settings/ConfigFieldForm"
import { persistPluginOptions, persistProviderOptions } from "@/lib/persist-project-config"
import { AdminRegistryFilters, matchesSearch } from "@/components/admin/AdminRegistryFilters"

type InstalledPlugin = {
  packageName: string
  displayName: string
  description: string | null
  category?: string
  versionSpec: string
  installedVersion: string
  latestVersion: string
  updateAvailable: boolean
  hasSettings: boolean
  settingsSchemaJson: BuilderSettings | null
  options: Record<string, unknown>
  fieldBindings: Record<string, FieldBinding>
}

type ModuleInfo = {
  module: string
  label: string
  providers: Array<{
    providerId: string
    displayName: string
    description: string
    settingsSchemaJson: BuilderSettings | null
    options: Record<string, unknown>
    fieldBindings: Record<string, FieldBinding>
    requiresPlugin?: string
  }>
  availableProviders: Array<{
    providerId: string
    displayName: string
    description?: string
    hasSettings?: boolean
    requiresPlugin?: string
  }>
}

type BackendResponse = {
  ready: boolean
  installedPlugins: InstalledPlugin[]
  modules: ModuleInfo[]
  githubLinked: boolean
  githubConfigured: boolean
  githubRepo: string | null
}

export function BackendPluginsPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<BackendResponse | null>(null)
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [settingsFilter, setSettingsFilter] = useState("all")
  const [updateFilter, setUpdateFilter] = useState("all")
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [bindings, setBindings] = useState<Record<string, FieldBinding>>({})
  const [syncGithub, setSyncGithub] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const skipAutoSaveRef = useRef(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/backend`)
    if (res.ok) setData(await res.json())
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const plugins = data?.installedPlugins ?? []
  const current = plugins.find((p) => p.packageName === selectedPlugin)

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      if (categoryFilter !== "all" && (p.category ?? "custom") !== categoryFilter) return false
      if (settingsFilter === "configurable" && !p.hasSettings) return false
      if (settingsFilter === "none" && p.hasSettings) return false
      if (updateFilter === "available" && !p.updateAvailable) return false
      const categoryLabel = PLUGIN_CATEGORY_LABELS[p.category ?? "custom"] ?? p.category
      return matchesSearch(search, [p.displayName, p.packageName, p.description, categoryLabel])
    })
  }, [plugins, categoryFilter, settingsFilter, updateFilter, search])

  const pluginCategoryOptions = useMemo(() => {
    const categories = new Set(plugins.map((p) => p.category ?? "custom"))
    return [
      { value: "all", label: "All categories" },
      ...Array.from(categories)
        .sort()
        .map((value) => ({
          value,
          label: PLUGIN_CATEGORY_LABELS[value] ?? value,
        })),
    ]
  }, [plugins])

  const hasActivePluginFilters =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    settingsFilter !== "all" ||
    updateFilter !== "all"

  function clearPluginFilters() {
    setSearch("")
    setCategoryFilter("all")
    setSettingsFilter("all")
    setUpdateFilter("all")
  }

  function handlePluginFilterChange(id: string, value: string) {
    if (id === "category") setCategoryFilter(value)
    if (id === "settings") setSettingsFilter(value)
    if (id === "updates") setUpdateFilter(value)
  }

  useEffect(() => {
    if (selectedPlugin && !filteredPlugins.some((p) => p.packageName === selectedPlugin)) {
      setSelectedPlugin(null)
    }
  }, [filteredPlugins, selectedPlugin])

  useEffect(() => {
    if (!current?.settingsSchemaJson) return
    skipAutoSaveRef.current = true
    const hydrated = hydrateConfigFormState(
      current.settingsSchemaJson,
      current.options ?? {},
      current.fieldBindings ?? {}
    )
    setValues(hydrated.values)
    setBindings(hydrated.bindings)
    const t = setTimeout(() => {
      skipAutoSaveRef.current = false
    }, 0)
    return () => clearTimeout(t)
  }, [current])

  const saveOptions = useCallback(async () => {
    if (!current?.settingsSchemaJson) return
    setSaving(true)
    setMessage("")
    const result = await persistPluginOptions(projectId, {
      packageName: current.packageName,
      values,
      bindings,
      syncGithub: syncGithub && !!data?.githubLinked,
    })
    setSaving(false)
    setMessage(
      result.ok ? "Saved to backend/plugins.config.json" : (result.error ?? "Save failed")
    )
    if (result.ok) load()
    setTimeout(() => setMessage(""), 3000)
  }, [current, projectId, values, bindings, syncGithub, data?.githubLinked, load])

  useEffect(() => {
    if (!current?.settingsSchemaJson || skipAutoSaveRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveOptions()
    }, 900)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [values, bindings, current, saveOptions])

  async function updateVersion(packageName: string, version: string) {
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-version", packageName, version }),
    })
    setMessage(res.ok ? `Updated ${packageName} to ^${version}` : "Version update failed")
    if (res.ok) load()
  }

  if (!data?.ready) {
    return <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Project workspace not ready.</p>
  }

  if (!plugins.length) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        No plugins in <code>backend/plugins.config.json</code>.
      </p>
    )
  }

  return (
    <div>
      <AdminRegistryFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search plugins…"
        filters={[
          {
            id: "category",
            label: "Category",
            value: categoryFilter,
            options: pluginCategoryOptions,
          },
          {
            id: "settings",
            label: "Settings",
            value: settingsFilter,
            options: [
              { value: "all", label: "All" },
              { value: "configurable", label: "Configurable" },
              { value: "none", label: "No settings" },
            ],
          },
          {
            id: "updates",
            label: "Updates",
            value: updateFilter,
            options: [
              { value: "all", label: "All" },
              { value: "available", label: "Update available" },
            ],
          },
        ]}
        onFilterChange={handlePluginFilterChange}
        onClear={clearPluginFilters}
        filteredCount={filteredPlugins.length}
        totalCount={plugins.length}
        hasActiveFilters={hasActivePluginFilters}
      />

      {filteredPlugins.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No plugins match your filters.</p>
      ) : (
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        {filteredPlugins.map((p) => (
          <div
            key={p.packageName}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: selectedPlugin === p.packageName ? "var(--border)" : "var(--surface)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => setSelectedPlugin(p.packageName)}
            >
              <strong style={{ fontSize: "0.875rem" }}>{p.displayName}</strong>
              <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)" }}>
                {p.packageName} · installed {p.versionSpec}
                {p.hasSettings ? " · configurable" : ""}
              </span>
            </button>
            <div style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
              {p.updateAvailable ? (
                <>
                  latest v{p.latestVersion}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginLeft: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}
                    onClick={() => updateVersion(p.packageName, p.latestVersion)}
                  >
                    Update
                  </button>
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>up to date</span>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {current?.hasSettings && current.settingsSchemaJson && (
        <>
          {current.description && (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
              {current.description}
            </p>
          )}
          <ConfigFieldForm
            schema={current.settingsSchemaJson}
            values={values}
            bindings={bindings}
            onValuesChange={setValues}
            onBindingsChange={setBindings}
            projectId={projectId}
          />
          {data.githubLinked && (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              <input type="checkbox" checked={syncGithub} onChange={(e) => setSyncGithub(e.target.checked)} />
              Push secret/variable values to GitHub repo
            </label>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => void saveOptions()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save now"}
          </button>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            Changes auto-save to <code>backend/plugins.config.json</code>
          </p>
        </>
      )}

      {message && (
        <div className="alert alert-success" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
          {message}
        </div>
      )}
    </div>
  )
}

export function BackendProvidersPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<BackendResponse | null>(null)
  const [selected, setSelected] = useState<{ module: string; providerId: string } | null>(null)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [settingsFilter, setSettingsFilter] = useState("all")
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [bindings, setBindings] = useState<Record<string, FieldBinding>>({})
  const [syncGithub, setSyncGithub] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const skipAutoSaveRef = useRef(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/backend`)
    if (res.ok) setData(await res.json())
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const modules = data?.modules ?? []
  const currentModule = modules.find((m) => m.module === selected?.module)
  const currentProvider = currentModule?.providers.find((p) => p.providerId === selected?.providerId)

  const totalProviderCount = useMemo(
    () => modules.reduce((sum, mod) => sum + mod.availableProviders.length, 0),
    [modules]
  )

  const filteredModules = useMemo(() => {
    return modules
      .filter((mod) => moduleFilter === "all" || mod.module === moduleFilter)
      .map((mod) => {
        const availableProviders = mod.availableProviders.filter((ap) => {
          const enabled = mod.providers.some((p) => p.providerId === ap.providerId)
          if (statusFilter === "enabled" && !enabled) return false
          if (statusFilter === "disabled" && enabled) return false
          const activeProvider = mod.providers.find((p) => p.providerId === ap.providerId)
          const hasSettings = enabled
            ? Boolean(activeProvider?.settingsSchemaJson?.fields?.length)
            : Boolean(ap.hasSettings)
          if (settingsFilter === "configurable" && !hasSettings) return false
          if (settingsFilter === "none" && hasSettings) return false
          return matchesSearch(search, [
            ap.displayName,
            ap.providerId,
            mod.label,
            activeProvider?.description ?? ap.description,
            ap.requiresPlugin,
          ])
        })
        const providers = mod.providers.filter((p) =>
          availableProviders.some((ap) => ap.providerId === p.providerId)
        )
        return { ...mod, availableProviders, providers }
      })
      .filter((mod) => mod.availableProviders.length > 0)
  }, [modules, moduleFilter, statusFilter, settingsFilter, search])

  const filteredProviderCount = useMemo(
    () => filteredModules.reduce((sum, mod) => sum + mod.availableProviders.length, 0),
    [filteredModules]
  )

  const moduleOptions = useMemo(
    () => [
      { value: "all", label: "All modules" },
      ...modules.map((mod) => ({ value: mod.module, label: mod.label })),
    ],
    [modules]
  )

  const hasActiveProviderFilters =
    search.trim() !== "" ||
    moduleFilter !== "all" ||
    statusFilter !== "all" ||
    settingsFilter !== "all"

  function clearProviderFilters() {
    setSearch("")
    setModuleFilter("all")
    setStatusFilter("all")
    setSettingsFilter("all")
  }

  function handleProviderFilterChange(id: string, value: string) {
    if (id === "module") setModuleFilter(value)
    if (id === "status") setStatusFilter(value)
    if (id === "settings") setSettingsFilter(value)
  }

  useEffect(() => {
    if (
      selected &&
      !filteredModules.some(
        (mod) =>
          mod.module === selected.module &&
          mod.providers.some((p) => p.providerId === selected.providerId)
      )
    ) {
      setSelected(null)
    }
  }, [filteredModules, selected])

  useEffect(() => {
    if (!currentProvider?.settingsSchemaJson) return
    skipAutoSaveRef.current = true
    const hydrated = hydrateConfigFormState(
      currentProvider.settingsSchemaJson,
      currentProvider.options ?? {},
      currentProvider.fieldBindings ?? {}
    )
    setValues(hydrated.values)
    setBindings(hydrated.bindings)
    const t = setTimeout(() => {
      skipAutoSaveRef.current = false
    }, 0)
    return () => clearTimeout(t)
  }, [currentProvider])

  const saveProviderOptions = useCallback(async () => {
    if (!currentProvider?.settingsSchemaJson) return
    setSaving(true)
    const result = await persistProviderOptions(projectId, {
      providerId: currentProvider.providerId,
      values,
      bindings,
      syncGithub: syncGithub && !!data?.githubLinked,
    })
    setSaving(false)
    setMessage(
      result.ok ? "Saved to backend/modules.config.json" : (result.error ?? "Save failed")
    )
    if (result.ok) load()
    setTimeout(() => setMessage(""), 3000)
  }, [currentProvider, projectId, values, bindings, syncGithub, data?.githubLinked, load])

  useEffect(() => {
    if (!currentProvider?.settingsSchemaJson || skipAutoSaveRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveProviderOptions()
    }, 900)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [values, bindings, currentProvider, saveProviderOptions])

  async function saveProviders(module: string, providers: string[]) {
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-module", module, providers }),
    })
    if (res.ok) load()
  }

  if (!data?.ready) return null

  return (
    <div>
      <AdminRegistryFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search providers…"
        filters={[
          {
            id: "module",
            label: "Module",
            value: moduleFilter,
            options: moduleOptions,
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: [
              { value: "all", label: "All" },
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Not enabled" },
            ],
          },
          {
            id: "settings",
            label: "Settings",
            value: settingsFilter,
            options: [
              { value: "all", label: "All" },
              { value: "configurable", label: "Configurable" },
              { value: "none", label: "No settings" },
            ],
          },
        ]}
        onFilterChange={handleProviderFilterChange}
        onClear={clearProviderFilters}
        filteredCount={filteredProviderCount}
        totalCount={totalProviderCount}
        hasActiveFilters={hasActiveProviderFilters}
      />

      {filteredModules.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No providers match your filters.</p>
      ) : (
      filteredModules.map((mod) => (
        <div key={mod.module} style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>{mod.label}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
            {mod.availableProviders.map((ap) => {
              const active = mod.providers.some((p) => p.providerId === ap.providerId)
              return (
                <button
                  key={ap.providerId}
                  type="button"
                  className={active ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
                  onClick={() => {
                    const next = active
                      ? mod.providers.map((p) => p.providerId).filter((id) => id !== ap.providerId)
                      : [...mod.providers.map((p) => p.providerId), ap.providerId]
                    saveProviders(mod.module, next)
                  }}
                >
                  {ap.displayName}
                </button>
              )
            })}
          </div>
          {mod.providers.map((p) => (
            <button
              key={p.providerId}
              type="button"
              className="btn btn-secondary"
              style={{
                width: "100%",
                marginBottom: "0.35rem",
                justifyContent: "flex-start",
                background:
                  selected?.providerId === p.providerId ? "var(--border)" : undefined,
              }}
              onClick={() => setSelected({ module: mod.module, providerId: p.providerId })}
            >
              Configure {p.displayName}
            </button>
          ))}
        </div>
      ))
      )}

      {currentProvider?.settingsSchemaJson && (
        <>
          {currentProvider.requiresPlugin && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              Requires plugin <code>{currentProvider.requiresPlugin}</code> in{" "}
              <code>backend/plugins.config.json</code>.
            </p>
          )}
          {currentProvider.description && (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
              {currentProvider.description}
            </p>
          )}
          <ConfigFieldForm
            schema={currentProvider.settingsSchemaJson}
            values={values}
            bindings={bindings}
            onValuesChange={setValues}
            onBindingsChange={setBindings}
            projectId={projectId}
          />
          {data.githubLinked && (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              <input type="checkbox" checked={syncGithub} onChange={(e) => setSyncGithub(e.target.checked)} />
              Push secret/variable values to GitHub repo
            </label>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => void saveProviderOptions()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save now"}
          </button>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            Changes auto-save to <code>backend/modules.config.json</code>
          </p>
        </>
      )}

      {message && (
        <div className="alert alert-success" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
          {message}
        </div>
      )}
    </div>
  )
}

export function GithubActionsConfigPanel({ projectId }: { projectId: string }) {
  const [secrets, setSecrets] = useState<Array<{ name: string }>>([])
  const [variables, setVariables] = useState<Array<{ name: string; value: string }>>([])
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [kind, setKind] = useState<"secret" | "variable">("secret")
  const [message, setMessage] = useState("")
  const [blocked, setBlocked] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/github/actions-config`)
    if (res.status === 400 || res.status === 503) {
      const body = await res.json().catch(() => ({}))
      setBlocked(body.error ?? "GitHub not available")
      return
    }
    if (!res.ok) return
    const data = await res.json()
    setSecrets(data.secrets ?? [])
    setVariables(data.variables ?? [])
    setBlocked(null)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${projectId}/github/actions-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind, name, value }),
    })
    setMessage(res.ok ? `Created ${kind} ${name}` : "Failed to create")
    if (res.ok) {
      setName("")
      setValue("")
      load()
    }
  }

  async function remove(type: "secret" | "variable", itemName: string) {
    const res = await fetch(`/api/projects/${projectId}/github/actions-config`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name: itemName }),
    })
    if (res.ok) load()
  }

  if (blocked) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        {blocked}. Link a GitHub repository on the project page and configure the GitHub App.
      </p>
    )
  }

  return (
    <div>
      <form onSubmit={create} style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: "0.5rem" }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as "secret" | "variable")}>
            <option value="secret">Secret</option>
            <option value="variable">Variable</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="NAME" required />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
            type={kind === "secret" ? "password" : "text"}
            required
          />
          <button type="submit" className="btn btn-primary">
            Add
          </button>
        </div>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <h4 style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}>Secrets ({secrets.length})</h4>
          {secrets.map((s) => (
            <div
              key={s.name}
              style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}
            >
              <code>{s.name}</code>
              <button type="button" className="btn btn-secondary" style={{ padding: "0 0.35rem" }} onClick={() => remove("secret", s.name)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}>Variables ({variables.length})</h4>
          {variables.map((v) => (
            <div key={v.name} style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code>{v.name}</code>
                <button type="button" className="btn btn-secondary" style={{ padding: "0 0.35rem" }} onClick={() => remove("variable", v.name)}>
                  ×
                </button>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{v.value}</span>
            </div>
          ))}
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>{message}</div>}
    </div>
  )
}
