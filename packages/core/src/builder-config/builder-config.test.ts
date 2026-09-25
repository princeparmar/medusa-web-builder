import { describe, expect, it } from "vitest"
import {
  applySchemaDefaults,
  compileBuilderConfig,
  dotKeysToNested,
  resolveInherits,
  stripDynamicConfigPlugin,
} from "./index"
import type { BuilderSettings } from "./types"

const heroSchema: BuilderSettings = {
  version: "1",
  fields: [
    { id: "variant", type: "select", default: "overlay", options: ["overlay", "split"] },
    { id: "homeBanner.title", type: "short-text", label: "Title" },
  ],
}

describe("builder-config", () => {
  it("applies schema defaults", () => {
    expect(applySchemaDefaults(heroSchema, {})).toEqual({ variant: "overlay" })
  })

  it("applies defaults block for arrays and objects", () => {
    const schema: BuilderSettings = {
      version: "1",
      fields: [{ id: "title", type: "short-text", default: "Features" }],
      defaults: {
        items: [{ name: "Secure checkout" }],
      },
    }
    expect(applySchemaDefaults(schema, {})).toEqual({
      title: "Features",
      items: [{ name: "Secure checkout" }],
    })
  })

  it("resolves brand inherits", () => {
    const schema: BuilderSettings = {
      version: "1",
      fields: [{ id: "logoUrl", type: "image" }],
      inherits: ["brand.logoUrl"],
    }
    expect(resolveInherits(schema, { logoUrl: "/logo.png" }, {})).toEqual({ logoUrl: "/logo.png" })
  })

  it("nests dot-notation keys", () => {
    expect(dotKeysToNested({ "homeBanner.title": "Hello", variant: "split" })).toEqual({
      homeBanner: { title: "Hello" },
      variant: "split",
    })
  })

  it("compiles sections and segment data for build", () => {
    const compiled = compileBuilderConfig({
      pages: [{ route: "/", segments: ["@pradip1995/segment-hero"] }],
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

    expect(compiled.sectionsConfig.segments["@pradip1995/segment-hero"]).toEqual({
      variant: "overlay",
      homeBanner: { title: "Welcome" },
    })
    expect(compiled.segmentData.data.hero).toEqual({
      variant: "overlay",
      homeBanner: { title: "Welcome" },
    })
  })

  it("strips dynamic-config plugin from plugins.config array", () => {
    const next = stripDynamicConfigPlugin({
      plugins: [
        { resolve: "medusa-plugin-dynamic-config", options: { configs: {} } },
        { resolve: "medusa-review-rating", options: {} },
      ],
    })
    expect(next.plugins).toEqual([{ resolve: "medusa-review-rating", options: {} }])
  })
})
