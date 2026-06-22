import { join } from "path"
import { mkdir } from "fs/promises"
import {
  compileBuilderConfig,
  stripDynamicConfigPlugin,
  type CompiledBuilderConfig,
  type PageEntry,
  type PluginsConfigFile,
  type ModulesConfigFile,
} from "../builder-config/index"
import type { BuilderSettings } from "../builder-config/types"
import type { BuilderBindingsFile } from "../builder-config/bindings"
import { emptyBindingsFile } from "../builder-config/bindings"
import { readProjectFile, writeProjectFile } from "../config/index"
import { readBrandConfig } from "../scaffold/index"

export type WriteBuilderArtifactsParams = {
  repoPath: string
  pages: PageEntry[]
  sectionProps: Record<string, unknown>
  brand?: Record<string, unknown>
  sections: Array<{
    packageName: string
    dataKey?: string
    settingsSchema?: BuilderSettings | null
  }>
}

export async function writeBuilderArtifacts(params: WriteBuilderArtifactsParams): Promise<CompiledBuilderConfig> {
  const { repoPath, pages, sectionProps, sections } = params
  const brand = params.brand ?? (await readBrandConfig(repoPath).catch(() => ({})))

  const compiled = compileBuilderConfig({ pages, sectionProps, brand, sections })
  const builderDir = join(repoPath, "storefront", "builder")
  await mkdir(builderDir, { recursive: true })

  await writeProjectFile(repoPath, "storefront/builder/section-props.json", sectionProps)
  await writeProjectFile(repoPath, "storefront/builder/sections.config.json", compiled.sectionsConfig)
  await writeProjectFile(repoPath, "storefront/builder/segment-data.json", compiled.segmentData)
  await writeProjectFile(repoPath, "storefront/builder/brand.json", brand)

  const pluginsConfig =
    (await readProjectFile<PluginsConfigFile>(repoPath, "backend/plugins.config.json")) ?? {}
  await writeProjectFile(
    repoPath,
    "backend/plugins.config.json",
    stripDynamicConfigPlugin(pluginsConfig)
  )

  return compiled
}

export async function readPluginsConfigFile(repoPath: string): Promise<PluginsConfigFile> {
  return (await readProjectFile<PluginsConfigFile>(repoPath, "backend/plugins.config.json")) ?? {}
}

export async function writePluginsConfigFile(
  repoPath: string,
  config: PluginsConfigFile
): Promise<void> {
  await writeProjectFile(repoPath, "backend/plugins.config.json", stripDynamicConfigPlugin(config))
}

export async function readModulesConfigFile(repoPath: string): Promise<ModulesConfigFile> {
  return (await readProjectFile<ModulesConfigFile>(repoPath, "backend/modules.config.json")) ?? {}
}

export async function writeModulesConfigFile(
  repoPath: string,
  config: ModulesConfigFile
): Promise<void> {
  await writeProjectFile(repoPath, "backend/modules.config.json", config)
}

export async function readBindingsFile(repoPath: string): Promise<BuilderBindingsFile> {
  return (
    (await readProjectFile<BuilderBindingsFile>(repoPath, "backend/builder-bindings.json")) ??
    emptyBindingsFile()
  )
}

export async function writeBindingsFile(
  repoPath: string,
  bindings: BuilderBindingsFile
): Promise<void> {
  await writeProjectFile(repoPath, "backend/builder-bindings.json", bindings)
}

export function parseInstalledVersion(spec: string | undefined): string | null {
  if (!spec) return null
  return spec.replace(/^[\^~>=<]+/, "").trim() || null
}

export {
  applySchemaDefaults,
  resolveInherits,
  compileSectionValues,
  compileBuilderConfig,
  pluginOptionsFromFieldValues,
  stripDynamicConfigPlugin,
} from "../builder-config/index"
export {
  compileOptionsWithBindings,
  suggestStorage,
  suggestEnvName,
  flattenBindingsForForm,
  emptyBindingsFile,
  type FieldBinding,
  type FieldStorage,
  type BuilderBindingsFile,
} from "../builder-config/bindings"
