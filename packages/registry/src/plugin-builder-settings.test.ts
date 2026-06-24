import { describe, expect, it } from "vitest"
import { PLUGIN_BUILDER_SETTINGS, pluginBuilderSettingsForPackage } from "./plugin-builder-settings"
import { mergePluginSettings } from "./settings-merge"

describe("plugin-builder-settings", () => {
  it("returns bundled settings for configurable plugins", () => {
    const schema = pluginBuilderSettingsForPackage("stock-monitoring")
    expect(schema.fields).toHaveLength(2)
    expect(schema.fields[0]?.id).toBe("low_stock_threshold")
    expect(schema.fields[0]?.default).toBe(10)
  })

  it("marks shiprocket credentials as required", () => {
    const schema = PLUGIN_BUILDER_SETTINGS["medusa-shiprocket-fulfillment-sbl"]
    const email = schema.fields.find((f) => f.id === "shiprocket.email")
    const password = schema.fields.find((f) => f.id === "shiprocket.password")
    expect(email?.required).toBe(true)
    expect(password?.required).toBe(true)
  })

  it("prefers repo builder.settings.json over bundled fallback", () => {
    const fromRepo = {
      version: "1",
      fields: [{ id: "custom", type: "short-text" as const, required: true }],
    }
    const merged = mergePluginSettings("stock-monitoring", fromRepo)
    expect(merged.fields[0]?.id).toBe("custom")
  })

  it("falls back to bundled settings when repo file is empty", () => {
    const merged = mergePluginSettings("medusa-review-rating", { version: "1", fields: [] })
    expect(merged.fields.some((f) => f.id === "autoApprove")).toBe(true)
  })

  it("returns empty schema for plugins without options", () => {
    const schema = pluginBuilderSettingsForPackage("medusa-product-helper")
    expect(schema.fields).toHaveLength(0)
  })
})
