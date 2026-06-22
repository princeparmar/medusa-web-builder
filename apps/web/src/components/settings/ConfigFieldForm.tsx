"use client"

import type { BuilderSettings } from "@mwb/registry/schemas"
import type { FieldBinding, FieldStorage } from "@mwb/core/builder-config/bindings"
import {
  allowedStorageForField,
  suggestEnvName,
  suggestStorage,
  countMissingRequiredFields,
} from "@mwb/core/builder-config/bindings"
import { ImageUploadField } from "@/components/ImageUploadField"

type Field = BuilderSettings["fields"][number]

const STORAGE_LABELS: Record<FieldStorage, string> = {
  hardcoded: "Hardcoded in config",
  "github-variable": "GitHub variable",
  "github-secret": "GitHub secret",
}

const STORAGE_HINTS: Record<FieldStorage, string> = {
  hardcoded: "Value is committed in backend/plugins.config.json",
  "github-variable": "Non-sensitive value stored as a GitHub Actions variable",
  "github-secret": "Sensitive value stored as an encrypted GitHub secret",
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
  const missingRequired = countMissingRequiredFields(schema, values, bindings)

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
    const next = { ...current, ...patch }
    if (field && patch.storage) {
      const allowed = allowedStorageForField(field)
      if (!allowed.includes(next.storage)) {
        next.storage = allowed[0]
      }
    }
    onBindingsChange({ ...bindings, [id]: next })
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

  if (!schema.fields.length) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
        This plugin has no configurable options.
      </p>
    )
  }

  return (
    <div>
      {missingRequired > 0 && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          {missingRequired} required field{missingRequired === 1 ? "" : "s"} still need a value or GitHub name.
        </div>
      )}

      {groups.map((group) => {
        const fields = fieldsByGroup.get(group.id)
        if (!fields?.length) return null
        return (
          <div key={group.id} style={{ marginBottom: "1.25rem" }}>
            {groups.length > 1 && (
              <h4 className="config-field-group-title">{group.label}</h4>
            )}
            {fields.map((field) => {
              const binding = bindings[field.id] ?? {
                storage: suggestStorage(field),
                name: suggestEnvName(field),
                value: values[field.id],
              }
              const allowed = allowedStorageForField(field)
              const isEnvBacked =
                binding.storage === "github-secret" || binding.storage === "github-variable"

              return (
                <div key={field.id} className="config-field-card">
                  <div className="config-field-card-header">
                    <label>
                      {field.label ?? field.id}
                      {field.required && <span className="config-field-required">Required</span>}
                    </label>
                    {field.description && (
                      <p className="config-field-description">{field.description}</p>
                    )}
                  </div>

                  <div className="config-field-storage-row">
                    <div>
                      <label className="config-field-sublabel">Where to store</label>
                      <select
                        value={binding.storage}
                        onChange={(e) =>
                          setBinding(field.id, { storage: e.target.value as FieldStorage })
                        }
                      >
                        {allowed.map((s) => (
                          <option key={s} value={s}>
                            {STORAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <p className="config-field-hint">{STORAGE_HINTS[binding.storage]}</p>
                    </div>
                    {isEnvBacked && (
                      <div>
                        <label className="config-field-sublabel">
                          GitHub {binding.storage === "github-secret" ? "secret" : "variable"} name
                        </label>
                        <input
                          value={binding.name ?? ""}
                          onChange={(e) => setBinding(field.id, { name: e.target.value })}
                          placeholder={field.envName ?? suggestEnvName(field)}
                        />
                      </div>
                    )}
                  </div>

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
                      <label className="config-field-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(values[field.id] ?? field.default)}
                          onChange={(e) => setField(field.id, e.target.checked)}
                        />
                        <span>Enabled</span>
                      </label>
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, Number(e.target.value))}
                      />
                    ) : field.type === "image" || field.type === "file" ? (
                      <ImageUploadField
                        projectId={projectId}
                        label=""
                        nested
                        value={String(values[field.id] ?? "")}
                        onChange={(url) => setField(field.id, url)}
                      />
                    ) : field.type === "long-text" ? (
                      <textarea
                        rows={2}
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, e.target.value)}
                      />
                    ) : (
                      <input
                        type={field.sensitive ? "password" : "text"}
                        value={String(values[field.id] ?? field.default ?? "")}
                        onChange={(e) => setField(field.id, e.target.value)}
                        placeholder={field.envName ? `Or use ${field.envName} via GitHub` : undefined}
                      />
                    )
                  ) : (
                    <input
                      type={binding.storage === "github-secret" ? "password" : "text"}
                      placeholder={`Value to push to GitHub ${binding.storage === "github-secret" ? "secret" : "variable"}`}
                      value={String(binding.value ?? values[field.id] ?? "")}
                      onChange={(e) => setBinding(field.id, { value: e.target.value })}
                    />
                  )}

                  {isEnvBacked && (
                    <p className="config-field-env-ref">
                      Generated config: <code>process.env.{binding.name || suggestEnvName(field)}</code>
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
