import type { BuilderSettings } from "@mwb/registry/schemas"
import { applySchemaDefaults, resolveInherits } from "@mwb/core/builder-config/write"

type Field = BuilderSettings["fields"][number]

export function PropertyForm({
  schema,
  values,
  onChange,
  projectId,
  brand,
}: {
  schema?: BuilderSettings | null
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  projectId: string
  brand?: Record<string, unknown>
}) {
  if (!schema?.fields?.length) {
    return <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No configurable properties</p>
  }

  const displayValues = resolveInherits(schema, brand ?? {}, applySchemaDefaults(schema, values))

  function setField(id: string, value: unknown) {
    onChange({ ...values, [id]: value })
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
            {fields.map((field: Field) => (
              <div key={field.id} className="form-group">
                <label>
                  {field.label ?? field.id}
                  {schema.inherits?.some((p) => p.endsWith(field.id) || p === `brand.${field.id}`) && (
                    <span style={{ fontSize: "0.65rem", color: "var(--muted)", marginLeft: "0.35rem" }}>
                      (inherits brand)
                    </span>
                  )}
                </label>
                {field.type === "select" ? (
                  <select
                    value={String(displayValues[field.id] ?? field.default ?? "")}
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
                    checked={Boolean(displayValues[field.id] ?? field.default)}
                    onChange={(e) => setField(field.id, e.target.checked)}
                  />
                ) : field.type === "image" || field.type === "file" ? (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadImage(field.id, f)
                      }}
                    />
                    {displayValues[field.id] ? (
                      <p style={{ fontSize: "0.75rem", marginTop: "0.25rem", wordBreak: "break-all" }}>
                        {String(displayValues[field.id])}
                      </p>
                    ) : null}
                  </div>
                ) : field.type === "long-text" ? (
                  <textarea
                    rows={3}
                    value={String(displayValues[field.id] ?? field.default ?? "")}
                    onChange={(e) => setField(field.id, e.target.value)}
                  />
                ) : field.type === "color" ? (
                  <input
                    type="color"
                    value={String(displayValues[field.id] ?? field.default ?? "#000000")}
                    onChange={(e) => setField(field.id, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(displayValues[field.id] ?? field.default ?? "")}
                    onChange={(e) => setField(field.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function initialValuesFromSchema(schema?: BuilderSettings | null): Record<string, unknown> {
  return applySchemaDefaults(schema, {})
}
