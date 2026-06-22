import type { BuilderField } from "./types"

export type FieldStorage = "hardcoded" | "github-variable" | "github-secret"

export type FieldBinding = {
  storage: FieldStorage
  /** GitHub Actions secret or variable name */
  name?: string
  /** Used when storage is hardcoded */
  value?: unknown
}

export type BuilderBindingsFile = {
  version: string
  plugins: Record<string, Record<string, FieldBinding>>
  providers: Record<string, Record<string, FieldBinding>>
}

export function emptyBindingsFile(): BuilderBindingsFile {
  return { version: "1", plugins: {}, providers: {} }
}

export function suggestStorage(field: BuilderField): FieldStorage {
  if (field.storage) return field.storage as FieldStorage
  if (field.sensitive) return "github-secret"
  const id = field.id.toLowerCase()
  if (
    id.includes("secret") ||
    id.includes("password") ||
    id.includes("pass") ||
    id.includes("token") ||
    id.includes("apikey") ||
    id.includes("api_key") ||
    id.includes("client_secret")
  ) {
    return "github-secret"
  }
  if (id.includes("host") || id.includes("url") || id.includes("port") || id.includes("environment")) {
    return "github-variable"
  }
  return "hardcoded"
}

export function allowedStorageForField(field: BuilderField): FieldStorage[] {
  if (field.allowedStorage?.length) return field.allowedStorage
  return ["hardcoded", "github-variable", "github-secret"]
}

const ENV_REF = /^process\.env\.([A-Z][A-Z0-9_]*)$/

function fieldIdToCompiledKey(fieldId: string): string {
  return fieldId.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function getNestedCompiledValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = obj
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    const record = cur as Record<string, unknown>
    const camel = part.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    cur = record[part] ?? record[camel]
  }
  return cur
}

function inferStorageFromEnvName(field: BuilderField, envName: string): FieldStorage {
  if (field.storage && field.storage !== "hardcoded") return field.storage
  if (field.sensitive) return "github-secret"
  const lower = envName.toLowerCase()
  if (lower.includes("secret") || lower.includes("password") || lower.includes("pass") || lower.includes("token")) {
    return "github-secret"
  }
  return "github-variable"
}

/** Reverse compiled pluginOptions / providerOptions into form values + bindings */
export function decompileOptionsToForm(
  compiled: Record<string, unknown>,
  fields: BuilderField[],
  existingBindings: Record<string, FieldBinding> = {}
): { values: Record<string, unknown>; bindings: Record<string, FieldBinding> } {
  const values: Record<string, unknown> = {}
  const bindings: Record<string, FieldBinding> = {}

  for (const field of fields) {
    const existing = existingBindings[field.id]
    const compiledValue = field.id.includes(".")
      ? getNestedCompiledValue(compiled, field.id)
      : compiled[fieldIdToCompiledKey(field.id)] ?? compiled[field.id]

    if (existing) {
      bindings[field.id] = { ...existing }
      if (existing.storage === "hardcoded") {
        values[field.id] = existing.value ?? compiledValue ?? field.default ?? ""
      } else {
        values[field.id] = existing.value ?? ""
        if (typeof compiledValue === "string" && ENV_REF.test(compiledValue)) {
          bindings[field.id].name = existing.name ?? compiledValue.match(ENV_REF)![1]
        }
      }
      continue
    }

    if (typeof compiledValue === "string" && ENV_REF.test(compiledValue)) {
      const envName = compiledValue.match(ENV_REF)![1]
      bindings[field.id] = {
        storage: inferStorageFromEnvName(field, envName),
        name: field.envName && field.envName === envName ? envName : envName,
      }
      values[field.id] = ""
      continue
    }

    if (compiledValue !== undefined) {
      values[field.id] = compiledValue
      bindings[field.id] = { storage: "hardcoded", value: compiledValue }
      continue
    }

    values[field.id] = field.default ?? ""
    bindings[field.id] = {
      storage: suggestStorage(field),
      name: suggestEnvName(field),
      value: field.default,
    }
  }

  return { values, bindings }
}

export function hydrateConfigFormState(
  schema: { fields: BuilderField[] },
  options: Record<string, unknown>,
  fieldBindings: Record<string, FieldBinding>
): { values: Record<string, unknown>; bindings: Record<string, FieldBinding> } {
  return decompileOptionsToForm(options, schema.fields, fieldBindings)
}

export function countMissingRequiredFields(
  schema: { fields: BuilderField[] },
  values: Record<string, unknown>,
  bindings: Record<string, FieldBinding>
): number {
  let missing = 0
  for (const field of schema.fields) {
    if (!field.required) continue
    const binding = bindings[field.id]
    const storage = binding?.storage ?? suggestStorage(field)
    if (storage === "hardcoded") {
      const v = binding?.value ?? values[field.id] ?? field.default
      if (v === undefined || v === null || v === "") missing++
    } else {
      if (!binding?.name) missing++
    }
  }
  return missing
}

export function suggestEnvName(field: BuilderField, prefix = ""): string {
  if (field.envName) return field.envName
  const base = field.id
    .replace(/\./g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()
  return prefix ? `${prefix}_${base}` : base
}

export function envReference(binding: FieldBinding): string {
  const name = binding.name ?? ""
  if (binding.storage === "github-secret" || binding.storage === "github-variable") {
    return `process.env.${name}`
  }
  if (typeof binding.value === "string") return binding.value
  if (binding.value !== undefined) return JSON.stringify(binding.value)
  return ""
}

/** Compile flat field values + bindings into pluginOptions / providerOptions for backend build */
export function compileOptionsWithBindings(
  flatValues: Record<string, unknown>,
  bindings: Record<string, FieldBinding>,
  fields: BuilderField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const field of fields) {
    const binding = bindings[field.id] ?? {
      storage: suggestStorage(field),
      name: suggestEnvName(field),
      value: flatValues[field.id],
    }

    let resolved: unknown
    if (binding.storage === "hardcoded") {
      resolved = binding.value ?? flatValues[field.id] ?? field.default
    } else {
      resolved = envReference({ ...binding, name: binding.name ?? suggestEnvName(field) })
    }

    if (resolved === undefined) continue

    const key = field.id
    if (key.includes(".")) {
      const parts = key.split(".")
      let cur = out as Record<string, unknown>
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in cur) || typeof cur[parts[i]] !== "object") {
          cur[parts[i]] = {}
        }
        cur = cur[parts[i]] as Record<string, unknown>
      }
      cur[parts[parts.length - 1]] = resolved
    } else {
      out[field.id] = resolved
    }
  }

  return out
}

export function flattenBindingsForForm(
  bindings: Record<string, FieldBinding>,
  flatValues: Record<string, unknown>,
  fields: BuilderField[]
): Record<string, FieldBinding> {
  const out: Record<string, FieldBinding> = { ...bindings }
  for (const field of fields) {
    if (!out[field.id]) {
      out[field.id] = {
        storage: suggestStorage(field),
        name: suggestEnvName(field),
        value: flatValues[field.id],
      }
    }
  }
  return out
}
