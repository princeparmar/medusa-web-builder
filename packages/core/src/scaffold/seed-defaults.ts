import type { BuilderSettings } from "../builder-config/types"
import { applySchemaDefaults } from "../builder-config"
import { writeBuilderArtifacts } from "../builder-config/write"
import { readPagesConfig, readBrandConfig } from "./index"

export const LAYOUT_SHELL_PACKAGES = [
  "@pradip1995/segment-nav",
  "@pradip1995/segment-footer",
  "@pradip1995/segment-promo-bar",
] as const

type PageEntry = {
  route: string
  segments: string[]
}

export type RegistrySectionSeed = {
  packageName: string
  settingsSchemaJson?: unknown
  manifestJson?: unknown
}

/** Copy aligned with create-storefront-app full preset + my-shop homepage defaults. */
const FIRST_SETUP_SECTION_OVERRIDES: Record<string, Record<string, unknown>> = {
  "@pradip1995/segment-hero": {
    "homeBanner.title": "Grace Woven In Every Thread",
    "homeBanner.subtitle": "Luxury Sarees • Curated For You",
    "homeBanner.description":
      "From festive celebrations to timeless everyday elegance, explore our exclusive saree collection crafted with beauty and comfort in mind.",
    "homeBanner.buttonName": "Explore Now",
    "homeBanner.buttonLink": "/store",
  },
  "@pradip1995/segment-promotional-banners": {
    banners: [
      {
        title: "Effortless Everyday Elegance",
        description:
          "Beautiful kurtis designed for comfort, style, and every moment of your day.",
        buttonName: "EXPLORE NOW",
        link: "/store",
      },
      {
        title: "Where Tradition Meets Style",
        description: "Exquisite sarees that bring timeless beauty to your wardrobe.",
        buttonName: "SHOP NOW",
        link: "/store",
      },
    ],
  },
  "@pradip1995/segment-promo-bar": {
    rotate: true,
    text: "Free shipping on orders above ₹999",
  },
}

function collectSegmentPackages(pages: PageEntry[]): Set<string> {
  const packages = new Set<string>(LAYOUT_SHELL_PACKAGES)
  for (const page of pages) {
    for (const seg of page.segments ?? []) {
      packages.add(seg)
    }
  }
  return packages
}

function seedPropsForPackage(
  packageName: string,
  schema: BuilderSettings | null | undefined
): Record<string, unknown> | null {
  if (!schema?.fields?.length && !schema?.defaults) return null
  const base = applySchemaDefaults(schema, {})
  const overrides = FIRST_SETUP_SECTION_OVERRIDES[packageName]
  return overrides ? { ...base, ...overrides } : base
}

export async function seedInitialBuilderState(
  repoPath: string,
  registry: RegistrySectionSeed[]
): Promise<{ sectionCount: number }> {
  const rawPages = (await readPagesConfig(repoPath).catch(() => [])) as PageEntry[]
  const packages = collectSegmentPackages(rawPages)
  const brand = await readBrandConfig(repoPath).catch(() => ({}))

  const sectionProps: Record<string, unknown> = {}
  const sectionMetas: Array<{
    packageName: string
    dataKey?: string
    settingsSchema?: BuilderSettings | null
  }> = []

  for (const packageName of packages) {
    const reg = registry.find((r) => r.packageName === packageName)
    const schema = (reg?.settingsSchemaJson ?? null) as BuilderSettings | null
    const props = seedPropsForPackage(packageName, schema)
    if (props) {
      sectionProps[packageName] = props
    }
    const manifest = reg?.manifestJson as { dataKey?: string } | undefined
    sectionMetas.push({
      packageName,
      dataKey: manifest?.dataKey,
      settingsSchema: schema,
    })
  }

  await writeBuilderArtifacts({
    repoPath,
    pages: rawPages.map((p) => ({ route: p.route, segments: p.segments ?? [] })),
    sectionProps,
    brand,
    sections: sectionMetas,
  })

  return { sectionCount: Object.keys(sectionProps).length }
}
