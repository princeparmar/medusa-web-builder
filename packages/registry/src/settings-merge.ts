import type { BuilderSettings } from "./schemas/index"
import { pluginBuilderSettingsForPackage } from "./plugin-builder-settings"

export const EMPTY_BUILDER_SETTINGS: BuilderSettings = { version: "1", fields: [] }

/** Prefer builder.settings.json from the package repo; no bundled fallback in MWB. */
export function mergeSegmentSettings(
  _slug: string,
  fromPackage?: BuilderSettings | null
): BuilderSettings {
  return fromPackage ?? EMPTY_BUILDER_SETTINGS
}

export function mergePluginSettings(
  packageName: string,
  fromRepo?: BuilderSettings | null
): BuilderSettings {
  if (fromRepo?.fields?.length) return fromRepo
  const bundled = pluginBuilderSettingsForPackage(packageName)
  if (bundled.fields.length) return bundled
  return fromRepo ?? EMPTY_BUILDER_SETTINGS
}
