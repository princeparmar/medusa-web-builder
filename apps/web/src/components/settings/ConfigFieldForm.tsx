"use client"

import type { BuilderSettings } from "@mwb/registry/schemas"
import type { FieldBinding, FieldStorage } from "@mwb/core/builder-config/bindings"
import { suggestEnvName, suggestStorage } from "@mwb/core/builder-config/bindings"

type Field = BuilderSettings["fields"][number]

const STORAGE_LABELS: Record<FieldStorage, string> = {
  hardcoded: "Hardcoded in config",
  "github-variable": "GitHub variable",
  "github-secret": "GitHub secret",
}

export function ConfigFieldForm({
  schema,
  values,
  bindings,
  onValuesChange,
  onBindingsChange,
  projectId,
}: {
  schema: BuilderSettings
  values: Record<string, unknown>
  bindings: Record<string, FieldBinding>
  onValuesChange: (values: Record<string, unknown>) => void
  onBindingsChange: (bindings: Record<string, FieldBinding>) => void
  projectId: string
}) {
  function setField(id: string, value: unknown) {
    onValuesChange({ ...values, [id]: value })
    const binding = bindings[id]
    if (binding?.storage === "hardcoded") {
      onBindingsChange({ ...bindings, [id]: { ...binding, value } })
    }
  }

  function setBinding(id: string, patch: Partial<FieldBinding>) {
    const field = schema.fields.find((f) => f.id === id)
    const current = bindings[id] ?? {
      storage: field ? suggestStorage(field) : "hardcoded",
      name: field ? suggestEnvName(field) : id.toUpperCase(),
      value: values[id],
    }
    onBindingsChange({ ...bindings, [id]: { ...current, ...patch } })
  }

  async function uploadImage(fieldId: string, file: File) {
    const form = new FormData()
    form.append("files", file)
    const res = await fetch(`/api/projects/${projectId}/upload`, { method: "POST", body: form })
    if (!res.ok) return
    const data = await res.json()
    const url = data.files?.[0]?.medusaFileUrl
    if (url) setField(fieldId, url)
  }

  const groups = schema.groups?.length
    ? schema.groups
    : [{ id: "default", label: "Settings" }]

  const fieldsByGroup = new Map<string, Field[]>()
  for (const field of schema.fields) {
    const groupId = field.group ?? "default"
    if (!fieldsByGroup.has(groupId)) fieldsByGroup.set(groupId, [])
    fieldsByGroup.get(groupId)!.push(field)
  }

  return (
    <div>
      {groups.map((group) => {
        const fields = fieldsByGroup.get(group.id)
        if (!fields?.length) return null
        return (
          <div key={group.id} style={{ marginBottom: "1.25rem" }}>
            {groups.length > 1 && (
              <h4
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--muted)",
                  marginBottom: "0.5rem",
                }}
              >
                {group.label}
              </h4>
            )}
            {fields.map((field) => {
              const binding = bindings[field.id] ?? {
                storage: suggestStorage(field),
                name: suggestEnvName(field),
                value: values[field.id],
              }
              const isEnvBacked =
                binding.storage === "github-secret" || binding.storage === "github-variable"

              return (
                <div
                  key={field.id}
                  className="form-group"
                  style={{
                    padding: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    marginBottom: "0.5rem",
                  }}
                >
                  <label style={{ display: "block", marginBottom: "0.35rem" }}>
                    {field.label ?? field.id}
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Storage</label>
                      <select
                        value={binding.storage}
                        onChange={(e) =>
                          setBinding(field.id, { storage: e.target.value as FieldStorage })
                        }
                      >
                        {(Object.keys(STORAGE_LABELS) as FieldStorage[]).map((s) => (
                          <option key={s} value={s}>
                            {STORAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isEnvBacked && (
                      <div>
                        <label style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                          GitHub {binding.storage === "github-secret" ? "secret" : "variable"} name
                        </label>
                        <input
                          value={binding.name ?? ""}
                          onChange={(e) => setBinding(field.id, { name: e.target.value })}
                          placeholder={suggestEnvName(field)}
                        />
                      </div>
                    )}
                  </div>
                  {field.storage && (
                    <p style={{ fontSize: "0.65rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
                      Suggested: {field.storage}
                      {field.envName ? ` · ${field.envName}` : ""}
                    </p>
                  )}
                  {!isEnvBacked ? (
                    field.type === "select" ? (
                      <select
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, e.target.value)}
                      >
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(values[field.id] ?? field.default)}
                        onChange={(e) => setField(field.id, e.target.checked)}
                      />
                    ) : field.type === "image" || field.type === "file" ? (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadImage(field.id, f)
                        }}
                      />
                    ) : field.type === "long-text" ? (
                      <textarea
                        rows={2}
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, e.target.value)}
                      />
                    ) : (
                      <input
                        type={field.sensitive || binding.storage === "github-secret" ? "password" : "text"}
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, e.target.value)}
                      />
                    )
                  ) : (
                    <input
                      type={binding.storage === "github-secret" ? "password" : "text"}
                      placeholder={`Value to store in GitHub ${binding.storage === "github-secret" ? "secret" : "variable"}`}
                      value={String(binding.value ?? values[field.id] ?? "")}
                      onChange={(e) => setBinding(field.id, { value: e.target.value })}
                    />
                  )}
                  {isEnvBacked && (
                    <p style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                      Saved as <code>process.env.{binding.name || suggestEnvName(field)}</code> in generated
                      config
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function initBindingsFromSchema(
  schema: BuilderSettings,
  values: Record<string, unknown>,
  existing: Record<string, FieldBinding> = {}
): Record<string, FieldBinding> {
  const out = { ...existing }
  for (const field of schema.fields) {
    if (!out[field.id]) {
      out[field.id] = {
        storage: suggestStorage(field),
        name: suggestEnvName(field),
        value: values[field.id] ?? field.default,
      }
    }
  }
  return out
}
