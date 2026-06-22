"use client"

import { useCallback, useEffect, useState } from "react"
import type { BuilderSettings } from "@mwb/registry/schemas"
import type { FieldBinding } from "@mwb/core/builder-config/bindings"
import { ConfigFieldForm, initBindingsFromSchema } from "@/components/settings/ConfigFieldForm"

type InstalledPlugin = {
  packageName: string
  displayName: string
  description: string | null
  versionSpec: string
  installedVersion: string
  latestVersion: string
  updateAvailable: boolean
  hasSettings: boolean
  settingsSchemaJson: BuilderSettings | null
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
    fieldBindings: Record<string, FieldBinding>
  }>
  availableProviders: Array<{ providerId: string; displayName: string }>
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
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [bindings, setBindings] = useState<Record<string, FieldBinding>>({})
  const [syncGithub, setSyncGithub] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/backend`)
    if (res.ok) setData(await res.json())
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const plugins = data?.installedPlugins ?? []
  const current = plugins.find((p) => p.packageName === selectedPlugin)

  useEffect(() => {
    if (!current?.settingsSchemaJson) return
    setValues({})
    setBindings(initBindingsFromSchema(current.settingsSchemaJson, {}, current.fieldBindings))
  }, [current])

  async function updateVersion(packageName: string, version: string) {
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-version", packageName, version }),
    })
    setMessage(res.ok ? `Updated ${packageName} to ^${version}` : "Version update failed")
    if (res.ok) load()
  }

  async function saveOptions() {
    if (!current?.settingsSchemaJson) return
    setSaving(true)
    setMessage("")
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-plugin-options",
        packageName: current.packageName,
        values,
        bindings,
        syncGithub: syncGithub && data?.githubLinked,
      }),
    })
    setSaving(false)
    setMessage(res.ok ? "Plugin options saved" : "Save failed")
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
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        {plugins.map((p) => (
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
              </span>
            </button>
            <div style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
              latest v{p.latestVersion}
              {p.updateAvailable && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginLeft: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}
                  onClick={() => updateVersion(p.packageName, p.latestVersion)}
                >
                  Update
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {current?.hasSettings && current.settingsSchemaJson && (
        <>
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
            className="btn btn-primary"
            style={{ marginTop: "0.75rem" }}
            onClick={saveOptions}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save plugin options"}
          </button>
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
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [bindings, setBindings] = useState<Record<string, FieldBinding>>({})
  const [syncGithub, setSyncGithub] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (!currentProvider?.settingsSchemaJson) return
    setValues({})
    setBindings(
      initBindingsFromSchema(currentProvider.settingsSchemaJson, {}, currentProvider.fieldBindings)
    )
  }, [currentProvider])

  async function saveProviders(module: string, providers: string[]) {
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-module", module, providers }),
    })
    if (res.ok) load()
  }

  async function saveProviderOptions() {
    if (!currentProvider?.settingsSchemaJson) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/backend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-provider-options",
        providerId: currentProvider.providerId,
        values,
        bindings,
        syncGithub: syncGithub && data?.githubLinked,
      }),
    })
    setSaving(false)
    setMessage(res.ok ? "Provider options saved" : "Save failed")
    if (res.ok) load()
  }

  if (!data?.ready) return null

  return (
    <div>
      {modules.map((mod) => (
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
      ))}

      {currentProvider?.settingsSchemaJson && (
        <>
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
            className="btn btn-primary"
            style={{ marginTop: "0.75rem" }}
            onClick={saveProviderOptions}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save provider options"}
          </button>
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
