import type { BuilderSettings } from "./schemas/index"
import { mergePluginSettings } from "./settings-merge"

export { mergePluginSettings, EMPTY_BUILDER_SETTINGS } from "./settings-merge"

export function pluginBuilderSettingsForPackage(_packageName: string): BuilderSettings | undefined {
  return undefined
}

export function providerSettingsForPackage(_packageName: string): never[] {
  return []
}
