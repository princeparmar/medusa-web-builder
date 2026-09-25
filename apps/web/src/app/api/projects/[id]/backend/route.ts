import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  readPluginsConfigFile,
  writePluginsConfigFile,
  readBackendPackageJson,
  updateBackendDependencyVersion,
  readModulesConfigFile,
  writeModulesConfigFile,
  readBindingsFile,
  writeBindingsFile,
  compileOptionsWithBindings,
  parseInstalledVersion,
  listEnabledPlugins,
} from "@mwb/core/builder-config/write"
import {
  createOrUpdateRepoSecret,
  createRepoVariable,
  updateRepoVariable,
} from "@mwb/core/github/actions-config"
import { githubCredentialsConfigured } from "@mwb/core/github"
import { MODULE_LABELS } from "@mwb/registry/providers-catalog"
import { listProvidersFromDb, getProviderById } from "@mwb/registry/providers-sync"
import { enrichPluginRecord, fetchNpmLatestVersion, resolvePluginLatestVersion } from "@mwb/registry"
import type { BuilderSettings } from "@mwb/registry/schemas"
import type { FieldBinding } from "@mwb/core/builder-config/bindings"
import { z } from "zod"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:read")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath || !existsSync(project.workspacePath)) {
    return NextResponse.json({
      ready: false,
      installedPlugins: [],
      modules: [],
      bindings: { version: "1", plugins: {}, providers: {} },
      githubLinked: !!project.githubRepo,
      githubConfigured: githubCredentialsConfigured(),
    })
  }

  const repoPath = resolve(project.workspacePath)
  const pluginsConfig = await readPluginsConfigFile(repoPath)
  const backendPkg = await readBackendPackageJson(repoPath)
  const backendDeps = backendPkg.dependencies ?? {}
  const modulesConfig = await readModulesConfigFile(repoPath)
  const bindings = await readBindingsFile(repoPath)

  const registry = await prisma.pluginRegistry.findMany({ orderBy: { displayName: "asc" } })
  const registryByName = new Map(registry.map((p) => [p.packageName, p]))

  const installedPlugins = await Promise.all(
    listEnabledPlugins(pluginsConfig).map(async (packageName) => {
      const reg = registryByName.get(packageName)
      const versionSpec = backendDeps[packageName] ?? ""
      const installed = parseInstalledVersion(versionSpec) ?? versionSpec
      const npmLatest = await fetchNpmLatestVersion(packageName)
      const registryLatest = reg?.latestVersion ?? reg?.version ?? null
      const { latest, updateAvailable } = resolvePluginLatestVersion(
        installed,
        registryLatest,
        npmLatest
      )
      const enriched = reg ? enrichPluginRecord(reg) : null
      const schema = reg?.settingsSchemaJson as BuilderSettings | null
      return {
        packageName,
        displayName: reg?.displayName ?? packageName,
        description: enriched?.description ?? null,
        category: enriched?.category ?? "custom",
        versionSpec,
        installedVersion: installed,
        registryVersion: reg?.version ?? null,
        latestVersion: latest,
        npmLatest,
        updateAvailable,
        hasSettings: Boolean(schema?.fields?.length),
        settingsSchemaJson: schema,
        options: pluginsConfig.plugins?.find(
          (p) =>
            p.resolve === packageName ||
            p.resolve.startsWith(`${packageName}/`) ||
            (packageName === "medusa-analytics" && p.resolve.includes("medusa-analytics"))
        )?.options ?? {},
        fieldBindings: bindings.plugins[packageName] ?? {},
      }
    })
  )

  const providerRegistry = await listProvidersFromDb()
  const providersByModule = new Map<string, typeof providerRegistry>()
  for (const p of providerRegistry) {
    if (!providersByModule.has(p.module)) providersByModule.set(p.module, [])
    providersByModule.get(p.module)!.push(p)
  }

  const modules = ["auth", "fulfillment", "payment", "notification", "file"].map((moduleKey) => {
    const mod = modulesConfig[moduleKey] as
      | { providers?: Array<{ id: string; options?: Record<string, unknown> }>; enabled?: string | boolean; mode?: string }
      | undefined
    const selectedProviders = (mod?.providers ?? []).map((p) => (typeof p === "string" ? p : p.id))
    const moduleProviders = providersByModule.get(moduleKey) ?? []
    const providers = selectedProviders.map((providerId) => {
      const reg = moduleProviders.find((p) => p.providerId === providerId)
      const entry = (mod?.providers ?? []).find(
        (p) => typeof p === "object" && p.id === providerId
      ) as { options?: Record<string, unknown> } | undefined
      const options = entry?.options ?? {}
      return {
        module: moduleKey,
        providerId,
        displayName: reg?.displayName ?? providerId,
        description: reg?.description ?? "",
        settingsSchemaJson: reg?.settings ?? null,
        options,
        fieldBindings: bindings.providers[providerId] ?? {},
        requiresPlugin: reg?.requiresPlugin ?? undefined,
      }
    })
    return {
      module: moduleKey,
      label: MODULE_LABELS[moduleKey] ?? moduleKey,
      providers,
      availableProviders: moduleProviders.map((p) => ({
        providerId: p.providerId,
        displayName: p.displayName,
        description: p.description ?? "",
        hasSettings: Boolean(p.settings?.fields?.length),
        requiresPlugin: p.requiresPlugin ?? undefined,
      })),
    }
  })

  return NextResponse.json({
    ready: true,
    medusaVersion: backendDeps["@medusajs/medusa"] ?? null,
    installedPlugins,
    modules,
    bindings,
    modulesConfig,
    pluginsConfig,
    githubLinked: !!project.githubRepo,
    githubRepo: project.githubRepo,
    githubConfigured: githubCredentialsConfigured(),
  })
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update-version"),
    packageName: z.string(),
    version: z.string(),
  }),
  z.object({
    action: z.literal("save-plugin-options"),
    packageName: z.string(),
    values: z.record(z.unknown()),
    bindings: z.record(
      z.object({
        storage: z.enum(["hardcoded", "github-variable", "github-secret"]),
        name: z.string().optional(),
        value: z.unknown().optional(),
      })
    ),
    syncGithub: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("save-module"),
    module: z.string(),
    providers: z.array(z.string()),
  }),
  z.object({
    action: z.literal("save-provider-options"),
    providerId: z.string(),
    values: z.record(z.unknown()),
    bindings: z.record(
      z.object({
        storage: z.enum(["hardcoded", "github-variable", "github-secret"]),
        name: z.string().optional(),
        value: z.unknown().optional(),
      })
    ),
    syncGithub: z.boolean().optional(),
  }),
])

async function syncBindingsToGithub(
  repoFullName: string,
  bindings: Record<string, FieldBinding>,
  values: Record<string, unknown>
) {
  for (const [fieldId, binding] of Object.entries(bindings)) {
    const raw = binding.value ?? values[fieldId]
    if (raw === undefined || raw === null || raw === "") continue
    const name = binding.name
    if (!name) continue

    if (binding.storage === "github-secret") {
      await createOrUpdateRepoSecret(repoFullName, name, String(raw))
    } else if (binding.storage === "github-variable") {
      try {
        await updateRepoVariable(repoFullName, name, String(raw))
      } catch {
        await createRepoVariable(repoFullName, name, String(raw))
      }
    }
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, membership } = await requireProjectAccess(id, "project:edit")
  if (error) return error

  const project = membership!.project
  if (!project.workspacePath) {
    return NextResponse.json({ error: "Project not ready" }, { status: 400 })
  }

  const body = bodySchema.parse(await request.json())
  const repoPath = resolve(project.workspacePath)

  if (body.action === "update-version") {
    const version = await updateBackendDependencyVersion(
      repoPath,
      body.packageName,
      body.version
    )
    return NextResponse.json({ ok: true, version })
  }

  if (body.action === "save-plugin-options") {
    const plugin = await prisma.pluginRegistry.findUnique({ where: { packageName: body.packageName } })
    if (!plugin) return NextResponse.json({ error: "Plugin not found" }, { status: 404 })

    const schema = plugin.settingsSchemaJson as BuilderSettings | null
    const fields = schema?.fields ?? []
    const compiled = compileOptionsWithBindings(body.values, body.bindings, fields)

    const config = await readPluginsConfigFile(repoPath)
    const plugins = [...(config.plugins ?? [])]
    const idx = plugins.findIndex(
      (p) =>
        p.resolve === body.packageName ||
        p.resolve === plugin.medusaResolve ||
        p.resolve.startsWith(`${body.packageName}/`) ||
        (body.packageName === "medusa-analytics" && p.resolve.includes("medusa-analytics"))
    )
    if (idx >= 0) {
      plugins[idx] = { ...plugins[idx], options: compiled }
    } else {
      plugins.push({ resolve: plugin.medusaResolve || body.packageName, options: compiled })
    }

    const bindingsFile = await readBindingsFile(repoPath)
    bindingsFile.plugins[body.packageName] = body.bindings
    await writeBindingsFile(repoPath, bindingsFile)
    await writePluginsConfigFile(repoPath, { ...config, plugins })

    if (body.syncGithub && project.githubRepo) {
      await syncBindingsToGithub(project.githubRepo, body.bindings, body.values)
    }

    return NextResponse.json({ ok: true, pluginOptions: compiled })
  }

  if (body.action === "save-module") {
    const modulesConfig = await readModulesConfigFile(repoPath)
    const key = body.module
    const current = modulesConfig[key] ?? { providers: [] }
    const existing = current.providers ?? []
    const nextProviders = body.providers
      .map((id) => existing.find((p) => p.id === id))
      .filter(Boolean)
    const next = {
      ...modulesConfig,
      [key]: { ...current, providers: nextProviders },
    }
    await writeModulesConfigFile(repoPath, next)
    return NextResponse.json({ ok: true, providers: body.providers })
  }

  if (body.action === "save-provider-options") {
    const reg = await getProviderById(body.providerId)
    const fields = reg?.settings.fields ?? []
    const compiled = compileOptionsWithBindings(body.values, body.bindings, fields)

    const modulesConfig = await readModulesConfigFile(repoPath)
    for (const mod of Object.values(modulesConfig)) {
      if (!mod?.providers) continue
      const provider = mod.providers.find((p) => p.id === body.providerId)
      if (provider) {
        provider.options = compiled
      }
    }

    const bindingsFile = await readBindingsFile(repoPath)
    bindingsFile.providers[body.providerId] = body.bindings
    await writeBindingsFile(repoPath, bindingsFile)
    await writeModulesConfigFile(repoPath, modulesConfig)

    if (body.syncGithub && project.githubRepo) {
      await syncBindingsToGithub(project.githubRepo, body.bindings, body.values)
    }

    return NextResponse.json({ ok: true, providerOptions: compiled })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
