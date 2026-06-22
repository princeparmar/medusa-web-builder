import { join } from "path"
import { pathToFileURL } from "url"
import { existsSync } from "fs"
import type { ComponentType } from "react"

const segmentCache = new Map<string, ComponentType<Record<string, unknown>>>()
const layoutCache = new Map<
  string,
  ComponentType<{ data: Record<string, unknown>; children: React.ReactNode }>
>()

function componentsRoot(): string {
  const root = process.env.STOREFRONT_COMPONENTS_PATH
  if (!root) {
    throw new Error("STOREFRONT_COMPONENTS_PATH is not set — cannot load segment packages for preview")
  }
  return root
}

function packageEntry(packageName: string): string {
  const slug = packageName.replace("@pradip1995/", "")
  const entry = join(componentsRoot(), "packages", slug, "src", "index.ts")
  if (!existsSync(entry)) {
    throw new Error(`Segment entry not found: ${entry}`)
  }
  return entry
}

export function canLoadSegments(): boolean {
  const root = process.env.STOREFRONT_COMPONENTS_PATH
  return Boolean(root && existsSync(join(root, "packages", "segment-hero", "src", "index.ts")))
}

export async function loadSegmentComponent(
  packageName: string
): Promise<ComponentType<Record<string, unknown>>> {
  const cached = segmentCache.get(packageName)
  if (cached) return cached

  const mod = (await import(pathToFileURL(packageEntry(packageName)).href)) as {
    default: ComponentType<Record<string, unknown>>
  }
  if (!mod?.default) {
    throw new Error(`Segment package has no default export: ${packageName}`)
  }
  segmentCache.set(packageName, mod.default)
  return mod.default
}

export async function loadLayoutComponent(
  packageName: string
): Promise<ComponentType<{ data: Record<string, unknown>; children: React.ReactNode }>> {
  const cached = layoutCache.get(packageName)
  if (cached) return cached

  const mod = (await import(pathToFileURL(packageEntry(packageName)).href)) as {
    default: ComponentType<{ data: Record<string, unknown>; children: React.ReactNode }>
  }
  if (!mod?.default) {
    throw new Error(`Layout package has no default export: ${packageName}`)
  }
  layoutCache.set(packageName, mod.default)
  return mod.default
}
