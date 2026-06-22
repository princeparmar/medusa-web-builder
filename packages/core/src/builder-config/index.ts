import type { BuilderSettings } from "./types"

export type { BuilderSettings, BuilderField } from "./types"

export type SectionMeta = {
  packageName: string
  dataKey?: string
  settingsSchema?: BuilderSettings | null
}

export type PageEntry = {
  route: string
  segments: string[]
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = obj
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".")
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in cur) || typeof cur[part] !== "object" || cur[part] === null) {
      cur[part] = {}
    }
    cur = cur[part] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

/** Merge schema defaults into flat field values (dot-notation ids). */
export function applySchemaDefaults(
  schema: BuilderSettings | null | undefined,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (!schema?.fields?.length) return { ...values }
  const out = { ...values }
  for (const field of schema.fields) {
    if (out[field.id] === undefined && field.default !== undefined) {
      out[field.id] = field.default
    }
  }
  return out
}

/** Apply brand (or other) inherits declared in builder.settings.json. */
export function resolveInherits(
  schema: BuilderSettings | null | undefined,
  brand: Record<string, unknown>,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (!schema?.inherits?.length) return { ...values }
  const out = { ...values }

  for (const inheritPath of schema.inherits) {
    const [root, ...rest] = inheritPath.split(".")
    if (root !== "brand" || rest.length === 0) continue
    const brandValue = getNestedValue(brand, rest.join("."))
    if (brandValue === undefined) continue

    const fieldId = rest.join(".")
    const shortId = rest[rest.length - 1]
    if (out[fieldId] === undefined) out[fieldId] = brandValue
    if (out[shortId] === undefined) out[shortId] = brandValue
  }

  return out
}

/** Convert flat dot-notation keys to nested objects for storefront build. */
export function dotKeysToNested(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (!key.includes(".")) {
      result[key] = value
      continue
    }
    setNestedValue(result, key, value)
  }
  return result
}

export function compileSectionValues(
  schema: BuilderSettings | null | undefined,
  brand: Record<string, unknown>,
  rawValues: Record<string, unknown>
): Record<string, unknown> {
  const withDefaults = applySchemaDefaults(schema, rawValues)
  const withInherits = resolveInherits(schema, brand, withDefaults)
  return dotKeysToNested(withInherits)
}

export type CompiledBuilderConfig = {
  sectionsConfig: {
    version: string
    updatedAt: string
    segments: Record<string, Record<string, unknown>>
  }
  segmentData: {
    version: string
    updatedAt: string
    data: Record<string, Record<string, unknown>>
  }
}

export function compileBuilderConfig(params: {
  pages: PageEntry[]
  sectionProps: Record<string, unknown>
  brand: Record<string, unknown>
  sections: SectionMeta[]
}): CompiledBuilderConfig {
  const { pages, sectionProps, brand, sections } = params
  const sectionByPackage = new Map(sections.map((s) => [s.packageName, s]))
  const usedPackages = new Set<string>()

  for (const page of pages) {
    for (const pkg of page.segments ?? []) {
      usedPackages.add(pkg)
    }
  }

  const segments: Record<string, Record<string, unknown>> = {}
  const data: Record<string, Record<string, unknown>> = {}

  for (const packageName of usedPackages) {
    const meta = sectionByPackage.get(packageName)
    const schema = meta?.settingsSchema ?? null
    const raw = (sectionProps[packageName] as Record<string, unknown>) ?? {}
    const compiled = compileSectionValues(schema, brand, raw)
    segments[packageName] = compiled

    const dataKey =
      meta?.dataKey ??
      (meta?.settingsSchema ? undefined : packageName.split("/").pop()?.replace(/^segment-/, ""))

    const key =
      dataKey ??
      (packageName.includes("segment-")
        ? packageName
            .split("/")
            .pop()!
            .replace(/^segment-/, "")
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        : packageName.split("/").pop() ?? packageName)

    data[key] = { ...(data[key] ?? {}), ...compiled }
  }

  const updatedAt = new Date().toISOString()
  return {
    sectionsConfig: { version: "1", updatedAt, segments },
    segmentData: { version: "1", updatedAt, data },
  }
}

export type PluginsConfigFile = {
  medusa?: string
  plugins?: Record<string, string>
  pluginOptions?: Record<string, Record<string, unknown>>
  enabled?: string[]
}

export type ModulesConfigFile = {
  auth?: { providers?: string[] }
  fulfillment?: { providers?: string[] }
  payment?: { enabled?: string | boolean; providers?: string[] }
  notification?: { enabled?: string | boolean; providers?: string[] }
  file?: { mode?: string; providers?: string[] }
  providerOptions?: Record<string, Record<string, unknown>>
}

const DYNAMIC_CONFIG_PLUGIN = "medusa-plugin-dynamic-config"

/** Remove dynamic-config plugin — CMS values live in storefront/builder/*.json instead. */
export function stripDynamicConfigPlugin(config: PluginsConfigFile): PluginsConfigFile {
  const next: PluginsConfigFile = { ...config, plugins: { ...config.plugins }, pluginOptions: { ...config.pluginOptions } }

  if (next.plugins) {
    delete next.plugins[DYNAMIC_CONFIG_PLUGIN]
  }
  if (next.enabled) {
    next.enabled = next.enabled.filter((p) => p !== DYNAMIC_CONFIG_PLUGIN)
  }
  if (next.pluginOptions) {
    delete next.pluginOptions[DYNAMIC_CONFIG_PLUGIN]
  }

  return next
}

export function builderFieldIdToPluginOptionKey(fieldId: string): string {
  return fieldId.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** Map flat builder field values to medusa pluginOptions shape (camelCase keys). */
export function pluginOptionsFromFieldValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (key.includes(".")) {
      setNestedValue(out, builderFieldIdToPluginOptionKey(key), value)
    } else {
      out[builderFieldIdToPluginOptionKey(key)] = value
    }
  }
  return out
}
