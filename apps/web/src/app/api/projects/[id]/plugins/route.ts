import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { prisma } from "@mwb/db"
import { requireProjectAccess } from "@/lib/auth-helpers"
import {
  readPluginsConfigFile,
  writePluginsConfigFile,
  pluginOptionsFromFieldValues,
} from "@mwb/core/builder-config/write"
import { enrichPluginRecord } from "@mwb/registry"
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
    return NextResponse.json({ pluginOptions: {}, plugins: [] })
  }

  const repoPath = resolve(project.workspacePath)
  const config = await readPluginsConfigFile(repoPath)
  const pluginOptions = config.pluginOptions ?? {}

  const registry = await prisma.pluginRegistry.findMany({ orderBy: { displayName: "asc" } })
  const enabledKeys = new Set([
    ...Object.keys(config.plugins ?? {}),
    ...(config.enabled ?? []),
  ])

  const plugins = registry
    .filter((p) => enabledKeys.has(p.packageName) || enabledKeys.has(p.medusaResolve))
    .map((p) => {
      const enriched = enrichPluginRecord(p)
      const schema = p.settingsSchemaJson as { fields?: unknown[] } | null
      const hasSettings = Boolean(schema?.fields?.length)
      return {
        packageName: p.packageName,
        medusaResolve: p.medusaResolve,
        displayName: p.displayName,
        description: enriched.description,
        category: enriched.category,
        settingsSchemaJson: hasSettings ? schema : null,
        options: pluginOptions[p.packageName] ?? pluginOptions[p.medusaResolve] ?? {},
      }
    })
    .filter((p) => p.settingsSchemaJson)

  return NextResponse.json({
    pluginOptions,
    plugins,
    pluginsConfig: config,
  })
}

const saveSchema = z.object({
  packageName: z.string(),
  values: z.record(z.unknown()),
})

export async function PUT(
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

  const body = saveSchema.parse(await request.json())
  const repoPath = resolve(project.workspacePath)
  const config = await readPluginsConfigFile(repoPath)

  const plugin = await prisma.pluginRegistry.findUnique({
    where: { packageName: body.packageName },
  })
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found in registry" }, { status: 404 })
  }

  const options = pluginOptionsFromFieldValues(body.values)
  const pluginOptions = { ...(config.pluginOptions ?? {}) }
  pluginOptions[plugin.packageName] = options
  if (plugin.medusaResolve !== plugin.packageName) {
    pluginOptions[plugin.medusaResolve] = options
  }

  await writePluginsConfigFile(repoPath, { ...config, pluginOptions })

  return NextResponse.json({ ok: true, pluginOptions: options })
}
