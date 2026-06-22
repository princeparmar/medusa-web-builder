import { compileBuilderConfig } from "@mwb/core/builder-config"
import { mergeBuilderSegmentData } from "@mwb/core/builder-config/preview-merge"
import { getSegmentProps } from "@mwb/core/builder-config/segment-props"
import { stripLayoutShells } from "@mwb/registry/layout-shell"
import { loadLayoutComponent, loadSegmentComponent, canLoadSegments } from "./load-segment"
import React, { type ReactNode } from "react"

type PageEntry = {
  route: string
  layout: string
  segments: string[]
}

type SectionMeta = {
  packageName: string
  displayName: string
  dataKey?: string
  settingsSchema?: import("@mwb/core/builder-config").BuilderSettings | null
}

const MOCK_CATEGORIES = [
  { id: "1", name: "New Arrivals", handle: "new-arrivals" },
  { id: "2", name: "Best Sellers", handle: "best-sellers" },
  { id: "3", name: "Sale", handle: "sale" },
]

function layoutPackageName(layout: string): string {
  if (layout.startsWith("@pradip1995/")) return layout
  if (layout.startsWith("layout-")) return `@pradip1995/${layout}`
  return `@pradip1995/layout-${layout}`
}

function stubWorkflowData(brand: Record<string, unknown>): Record<string, unknown> {
  const logoUrl = typeof brand.logoUrl === "string" ? brand.logoUrl : undefined
  return {
    nav: {
      categories: MOCK_CATEGORIES,
      collections: [],
      logoUrl,
      currentLocale: "en",
    },
    footer: { categories: MOCK_CATEGORIES },
    promoBar: {
      active: true,
      text: "Free shipping on orders over ₹999",
      code: "WELCOME10",
    },
    cart: null,
    hero: {
      homeBanner: {
        title: "New collection",
        subtitle: "Welcome to your store",
        description: "Discover our latest products.",
        buttonName: "Shop now",
        buttonLink: "/store",
        image: "",
      },
      appBanner: {
        title: "Shop on mobile",
        subtitle: "Welcome",
        description: "",
        buttonName: "Shop now",
        buttonLink: "/store",
        image: "",
      },
      variant: "overlay",
    },
  }
}

export type RenderLivePreviewInput = {
  pages: PageEntry[]
  route: string
  sectionProps: Record<string, unknown>
  brand: Record<string, unknown>
  sections: SectionMeta[]
}

export async function renderLivePreview(input: RenderLivePreviewInput): Promise<ReactNode> {
  if (!canLoadSegments()) {
    return (
      <div className="builder-preview-fallback">
        <p>Set STOREFRONT_COMPONENTS_PATH to enable live segment preview.</p>
      </div>
    )
  }

  const page = input.pages.find((p) => p.route === input.route) ?? input.pages[0]
  if (!page) {
    return <div className="builder-preview-fallback">No page configured.</div>
  }

  const compiled = compileBuilderConfig({
    pages: input.pages.map((p) => ({ route: p.route, segments: p.segments })),
    sectionProps: input.sectionProps,
    brand: input.brand,
    sections: input.sections.map((s) => ({
      packageName: s.packageName,
      dataKey: s.dataKey,
      settingsSchema: s.settingsSchema,
    })),
  })

  const data = mergeBuilderSegmentData(stubWorkflowData(input.brand), compiled.segmentData)
  const layoutPkg = layoutPackageName(page.layout)
  const Layout = await loadLayoutComponent(layoutPkg)
  const pageSegments = stripLayoutShells(page.segments)

  const segmentElements = await Promise.all(
    pageSegments.map(async (pkg) => {
      const Segment = await loadSegmentComponent(pkg)
      const props = getSegmentProps(pkg, data)
      return <Segment key={pkg} {...props} />
    })
  )

  return <Layout data={data}>{segmentElements}</Layout>
}
