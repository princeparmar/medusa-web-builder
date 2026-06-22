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
    id.includes("token") ||
    id.includes("apikey") ||
    id.includes("api_key")
  ) {
    return "github-secret"
  }
  if (id.includes("host") || id.includes("url") || id.includes("port")) {
    return "github-variable"
  }
  return "hardcoded"
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
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      out[camel] = resolved
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
