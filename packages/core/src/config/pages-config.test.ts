import { describe, expect, it } from "vitest"
import {
  buildPagesConfigFromBuilder,
  enrichPagesConfigWithSegmentDefaults,
  expandPagesConfigForBuilder,
  parsePagesConfigFile,
  segmentPackageName,
} from "../config/pages-config"
import type { BuilderSettings } from "../builder-config/types"

const heroSchema: BuilderSettings = {
  version: "1",
  fields: [
    { id: "variant", type: "select", default: "overlay", options: ["overlay", "split"] },
    { id: "homeBanner.title", type: "short-text", label: "Title" },
  ],
}

describe("pages-config", () => {
  it("co-locates segment package and compiled data", () => {
    const file = buildPagesConfigFromBuilder({
      pages: [
        {
          route: "/",
          workflow: "@pradip1995/workflow-home",
          layout: "@pradip1995/layout-default",
          segments: ["@pradip1995/segment-hero"],
        },
      ],
      sectionProps: {
        "@pradip1995/segment-hero": { "homeBanner.title": "Welcome" },
      },
      brand: {},
      sections: [
        {
          packageName: "@pradip1995/segment-hero",
          dataKey: "hero",
          settingsSchema: heroSchema,
        },
      ],
    })

    const hero = file.pages[0].segments[0]
    expect(segmentPackageName(hero)).toBe("@pradip1995/segment-hero")
    expect(typeof hero).toBe("object")
    expect((hero as { data: Record<string, unknown> }).data).toEqual({
      variant: "overlay",
      homeBanner: { title: "Welcome" },
    })
  })

  it("enrichPagesConfigWithSegmentDefaults embeds schema defaults", () => {
    const enriched = enrichPagesConfigWithSegmentDefaults({
      file: {
        version: "1",
        pages: [
          {
            route: "/",
            workflow: "w",
            layout: "l",
            segments: ["@pradip1995/segment-hero", "@pradip1995/segment-product-grid"],
          },
        ],
      },
      sections: [
        { packageName: "@pradip1995/segment-hero", settingsSchema: heroSchema },
        { packageName: "@pradip1995/segment-product-grid", settingsSchema: { version: "1", fields: [] } },
      ],
      overrides: {
        "@pradip1995/segment-hero": { "homeBanner.title": "Welcome" },
      },
    })

    const hero = enriched.pages[0].segments[0]
    expect(hero).toEqual({
      package: "@pradip1995/segment-hero",
      data: {
        variant: "overlay",
        homeBanner: { title: "Welcome" },
      },
    })
    expect(enriched.pages[0].segments[1]).toBe("@pradip1995/segment-product-grid")
  })

  it("round-trips through expandPagesConfigForBuilder", () => {
    const built = buildPagesConfigFromBuilder({
      pages: [{ route: "/", segments: ["@pradip1995/segment-hero"] }],
      sectionProps: { "@pradip1995/segment-hero": { "homeBanner.title": "Hi" } },
      brand: {},
      sections: [{ packageName: "@pradip1995/segment-hero", settingsSchema: heroSchema }],
    })

    const { pages, sectionProps } = expandPagesConfigForBuilder(built)
    expect(pages[0].segments).toEqual(["@pradip1995/segment-hero"])
    expect(sectionProps["@pradip1995/segment-hero"]).toMatchObject({ "homeBanner.title": "Hi" })
  })

  it("migrates legacy root segmentData", () => {
    const file = parsePagesConfigFile({
      version: "1",
      segmentData: {
        hero: { homeBanner: { title: "Legacy" } },
      },
      pages: [
        {
          route: "/",
          workflow: "w",
          layout: "l",
          segments: ["@pradip1995/segment-hero"],
        },
      ],
    })

    const ref = file.pages[0].segments[0]
    expect(ref).toEqual({
      package: "@pradip1995/segment-hero",
      data: { homeBanner: { title: "Legacy" } },
    })
  })
})
