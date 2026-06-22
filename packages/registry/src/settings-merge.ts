import type { BuilderSettings } from "./schemas/index"

export const EMPTY_BUILDER_SETTINGS: BuilderSettings = { version: "1", fields: [] }

/** Prefer builder.settings.json from the package repo; no bundled fallback in MWB. */
export function mergeSegmentSettings(
  _slug: string,
  fromPackage?: BuilderSettings | null
): BuilderSettings {
  return fromPackage ?? EMPTY_BUILDER_SETTINGS
}

export function mergePluginSettings(
  _packageName: string,
  fromRepo?: BuilderSettings | null
): BuilderSettings {
  return fromRepo ?? EMPTY_BUILDER_SETTINGS
}
