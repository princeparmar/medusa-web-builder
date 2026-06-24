import { stripLayoutShells } from "@mwb/registry/layout-shell"

export type BuilderPageEntry = {
  route: string
  workflow: string
  layout: string
  segments: string[]
  metadata?: { title?: string }
}

export async function persistBuilderState(
  projectId: string,
  payload: {
    pages: BuilderPageEntry[]
    brand: Record<string, unknown>
    sectionProps: Record<string, unknown>
  },
  options?: { rebuildStorefront?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const pagesToSave = payload.pages.map((p) => ({
    ...p,
    segments: stripLayoutShells(p.segments ?? []),
  }))

  const saveRes = await fetch(`/api/projects/${projectId}/pages`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pages: pagesToSave,
      brand: payload.brand,
      sectionProps: payload.sectionProps,
    }),
  })

  if (!saveRes.ok) {
    const data = await saveRes.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? "Could not save pages.config.json" }
  }

  if (options?.rebuildStorefront !== false) {
    const rebuildRes = await fetch(`/api/projects/${projectId}/storefront/rebuild`, {
      method: "POST",
    })
    if (!rebuildRes.ok) {
      const data = await rebuildRes.json().catch(() => ({}))
      return {
        ok: false,
        error: (data as { error?: string }).error ?? "pages.config.json saved but storefront rebuild failed",
      }
    }
  }

  return { ok: true }
}

export async function persistPluginOptions(
  projectId: string,
  payload: {
    packageName: string
    values: Record<string, unknown>
    bindings: Record<string, unknown>
    syncGithub?: boolean
  }
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/projects/${projectId}/backend`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save-plugin-options",
      packageName: payload.packageName,
      values: payload.values,
      bindings: payload.bindings,
      syncGithub: payload.syncGithub ?? false,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? "Could not save plugins.config.json" }
  }
  return { ok: true }
}

export async function persistProviderOptions(
  projectId: string,
  payload: {
    providerId: string
    values: Record<string, unknown>
    bindings: Record<string, unknown>
    syncGithub?: boolean
  }
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/projects/${projectId}/backend`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save-provider-options",
      providerId: payload.providerId,
      values: payload.values,
      bindings: payload.bindings,
      syncGithub: payload.syncGithub ?? false,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? "Could not save modules.config.json" }
  }
  return { ok: true }
}
