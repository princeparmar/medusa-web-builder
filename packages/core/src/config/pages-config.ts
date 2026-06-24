import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { compileSectionValues, type SectionMeta } from "../builder-config/index"

/** Layout chrome segments (nav, footer, promo) — global, not listed per page body */
export const CHROME_PACKAGES = [
  "@pradip1995/segment-nav",
  "@pradip1995/segment-footer",
  "@pradip1995/segment-promo-bar",
] as const

/** Segment reference in pages.config — package name with optional CMS data from builder.settings.json */
export type SegmentRef =
  | string
  | {
      package: string
      data?: Record<string, unknown>
    }

export type PageConfigEntry = {
  route: string
  workflow: string
  layout: string
  segments: SegmentRef[]
  metadata?: { title?: string; description?: string }
}

export type PagesConfigFile = {
  version?: string
  /** Global layout chrome (nav, footer, promo bar) with inline data */
  chrome?: SegmentRef[]
  pages: PageConfigEntry[]
}

export function segmentPackageName(ref: SegmentRef): string {
  return typeof ref === "string" ? ref : ref.package
}

export function segmentInlineData(ref: SegmentRef): Record<string, unknown> | undefined {
  return typeof ref === "string" ? undefined : ref.data
}

export function hasSegmentData(ref: SegmentRef): boolean {
  const data = segmentInlineData(ref)
  return Boolean(data && Object.keys(data).length > 0)
}

/** Flatten nested segment data to dot-notation keys for the builder property panel */
export function flattenSegmentData(data: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flat, flattenSegmentData(value as Record<string, unknown>, path))
    } else {
      flat[path] = value
    }
  }
  return flat
}

function segmentRefWithData(packageName: string, data: Record<string, unknown>): SegmentRef {
  if (!data || Object.keys(data).length === 0) return packageName
  return { package: packageName, data }
}

export function normalizeSegmentRefs(segments: unknown[]): SegmentRef[] {
  return segments.map((entry) => {
    if (typeof entry === "string") return entry
    if (entry && typeof entry === "object" && typeof (entry as { package?: string }).package === "string") {
      const ref = entry as { package: string; data?: Record<string, unknown> }
      return hasSegmentData(ref) ? ref : ref.package
    }
    throw new Error(`Invalid segment entry in pages.config.json: ${JSON.stringify(entry)}`)
  })
}

export function normalizePageEntry(page: Record<string, unknown>): PageConfigEntry {
  return {
    route: String(page.route),
    workflow: String(page.workflow),
    layout: String(page.layout),
    segments: normalizeSegmentRefs(Array.isArray(page.segments) ? page.segments : []),
    metadata:
      page.metadata && typeof page.metadata === "object"
        ? (page.metadata as PageConfigEntry["metadata"])
        : undefined,
  }
}

/** dataKey → package (for migrating legacy root segmentData) */
const DATA_KEY_TO_PACKAGE: Record<string, string> = {
  hero: "@pradip1995/segment-hero",
  nav: "@pradip1995/segment-nav",
  footer: "@pradip1995/segment-footer",
  promoBar: "@pradip1995/segment-promo-bar",
  shopByAge: "@pradip1995/segment-shop-by-age",
  shopByCategory: "@pradip1995/segment-shop-by-category",
  whyChooseUs: "@pradip1995/segment-why-choose-us",
  newArrivals: "@pradip1995/segment-new-arrivals",
  lovedByMoms: "@pradip1995/segment-loved-by-moms",
  testimonials: "@pradip1995/segment-testimonials",
  features: "@pradip1995/segment-features",
  promotionalBanners: "@pradip1995/segment-promotional-banners",
  collectionsShowcase: "@pradip1995/segment-collections-showcase",
  bestsellers: "@pradip1995/segment-bestsellers-carousel",
  helpPage: "@pradip1995/segment-help",
}

function legacyDataForPackage(
  legacy: Record<string, Record<string, unknown>>,
  packageName: string
): Record<string, unknown> | undefined {
  for (const [dataKey, pkg] of Object.entries(DATA_KEY_TO_PACKAGE)) {
    if (pkg === packageName && legacy[dataKey]) return legacy[dataKey]
  }
  const slug = packageName.split("/").pop()
  if (slug && legacy[slug]) return legacy[slug]
  return undefined
}

/** Migrate legacy { segmentData, pages with string[] } into inline segment data */
function migrateLegacySegmentData(file: {
  version?: string
  chrome?: SegmentRef[]
  segmentData?: Record<string, Record<string, unknown>>
  pages: PageConfigEntry[]
}): PagesConfigFile {
  const legacy = file.segmentData ?? {}
  const chrome: SegmentRef[] = [...(file.chrome ?? [])]

  for (const [dataKey, data] of Object.entries(legacy)) {
    const pkg = DATA_KEY_TO_PACKAGE[dataKey]
    if (!pkg || !data) continue
    if (CHROME_PACKAGES.includes(pkg as (typeof CHROME_PACKAGES)[number])) {
      if (!chrome.some((r) => segmentPackageName(r) === pkg)) {
        chrome.push(segmentRefWithData(pkg, data))
      }
      continue
    }
    for (const page of file.pages) {
      const idx = page.segments.findIndex((r) => segmentPackageName(r) === pkg)
      if (idx >= 0 && !segmentInlineData(page.segments[idx])) {
        page.segments[idx] = segmentRefWithData(pkg, data)
      }
    }
  }

  return {
    version: file.version ?? "1",
    chrome: chrome.length > 0 ? chrome : undefined,
    pages: file.pages,
  }
}

export function parsePagesConfigFile(raw: unknown): PagesConfigFile {
  if (Array.isArray(raw)) {
    return {
      version: "1",
      pages: raw.map((page) => normalizePageEntry(page as Record<string, unknown>)),
    }
  }

  if (raw && typeof raw === "object" && Array.isArray((raw as PagesConfigFile).pages)) {
    const file = raw as PagesConfigFile & { segmentData?: Record<string, Record<string, unknown>> }
    const normalized: PagesConfigFile = {
      version: file.version ?? "1",
      chrome: file.chrome ? normalizeSegmentRefs(file.chrome as unknown[]) : undefined,
      pages: file.pages.map((page) => normalizePageEntry(page as unknown as Record<string, unknown>)),
    }

    if (file.segmentData && Object.keys(file.segmentData).length > 0) {
      return migrateLegacySegmentData({ ...normalized, segmentData: file.segmentData })
    }

    return normalized
  }

  throw new Error("pages.config.json must be an array of pages or { pages, chrome? }")
}

/** Builder UI uses flat sectionProps keyed by package — expand from pages.config */
export function expandPagesConfigForBuilder(file: PagesConfigFile): {
  pages: Array<Omit<PageConfigEntry, "segments"> & { segments: string[] }>
  sectionProps: Record<string, Record<string, unknown>>
} {
  const sectionProps: Record<string, Record<string, unknown>> = {}

  const absorb = (ref: SegmentRef) => {
    const data = segmentInlineData(ref)
    if (!data) return
    const pkg = segmentPackageName(ref)
    sectionProps[pkg] = { ...(sectionProps[pkg] ?? {}), ...flattenSegmentData(data) }
  }

  for (const ref of file.chrome ?? []) absorb(ref)
  for (const page of file.pages) {
    for (const ref of page.segments) absorb(ref)
  }

  const pages = file.pages.map((page) => ({
    ...page,
    segments: page.segments.map(segmentPackageName),
  }))

  return { pages, sectionProps }
}

/** Embed compiled segment data next to each package name for pages.config.json */
export function enrichPagesConfigWithSegmentDefaults(params: {
  file: PagesConfigFile
  sections: SectionMeta[]
  brand?: Record<string, unknown>
  /** Flat dot-notation overrides per package (e.g. hero homeBanner.title) */
  overrides?: Record<string, Record<string, unknown>>
  /** When true, replace existing inline data with schema defaults + overrides */
  replaceExisting?: boolean
}): PagesConfigFile {
  const sectionByPackage = new Map(params.sections.map((s) => [s.packageName, s]))
  const brand = params.brand ?? {}

  const compileForPackage = (packageName: string): Record<string, unknown> => {
    const meta = sectionByPackage.get(packageName)
    const schema = meta?.settingsSchema ?? null
    const flatOverrides = params.overrides?.[packageName] ?? {}
    if (
      !schema?.fields?.length &&
      !schema?.defaults &&
      Object.keys(flatOverrides).length === 0
    ) {
      return {}
    }
    const raw = { ...flatOverrides }
    return compileSectionValues(schema, brand, raw)
  }

  const enrichRef = (ref: SegmentRef): SegmentRef => {
    const pkg = segmentPackageName(ref)
    if (hasSegmentData(ref) && !params.replaceExisting) return ref
    return segmentRefWithData(pkg, compileForPackage(pkg))
  }

  return {
    version: params.file.version ?? "1",
    chrome: params.file.chrome?.map(enrichRef),
    pages: params.file.pages.map((page) => ({
      ...page,
      segments: page.segments.map(enrichRef),
    })),
  }
}

/** Embed compiled segment data next to each package name for pages.config.json */
export function buildPagesConfigFromBuilder(params: {
  pages: Array<{
    route: string
    workflow?: string
    layout?: string
    segments: string[]
    metadata?: PageConfigEntry["metadata"]
  }>
  sectionProps: Record<string, unknown>
  brand: Record<string, unknown>
  sections: SectionMeta[]
  existingFile?: PagesConfigFile
}): PagesConfigFile {
  const sectionByPackage = new Map(params.sections.map((s) => [s.packageName, s]))
  const compile = (packageName: string): Record<string, unknown> => {
    const meta = sectionByPackage.get(packageName)
    const raw = (params.sectionProps[packageName] as Record<string, unknown>) ?? {}
    return compileSectionValues(meta?.settingsSchema ?? null, params.brand, raw)
  }

  const chrome: SegmentRef[] = []
  for (const pkg of CHROME_PACKAGES) {
    if (params.sectionProps[pkg] === undefined) continue
    chrome.push(segmentRefWithData(pkg, compile(pkg)))
  }

  const pages: PageConfigEntry[] = params.pages.map((page) => {
    const existing = params.existingFile?.pages.find((p) => p.route === page.route)
    return {
      route: page.route,
      workflow: page.workflow ?? existing?.workflow ?? "",
      layout: page.layout ?? existing?.layout ?? "",
      metadata: page.metadata ?? existing?.metadata,
      segments: page.segments.map((pkg) => segmentRefWithData(pkg, compile(pkg))),
    }
  })

  return {
    version: "1",
    chrome: chrome.length > 0 ? chrome : undefined,
    pages,
  }
}

export async function readPagesConfigFileFromRepo(repoPath: string): Promise<PagesConfigFile> {
  const path = `${repoPath}/storefront/pages.config.json`
  if (!existsSync(path)) {
    return { version: "1", pages: [] }
  }
  const content = await readFile(path, "utf8")
  return parsePagesConfigFile(JSON.parse(content))
}

export async function writePagesConfigFileToRepo(repoPath: string, file: PagesConfigFile): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises")
  const { join, dirname } = await import("path")
  const path = join(repoPath, "storefront", "pages.config.json")
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(file, null, 2) + "\n")
}
