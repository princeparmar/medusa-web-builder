import { describe, it, expect } from "vitest"
import { BuilderSettingsSchema } from "./index"

/** Minimal fixture — real schemas live in storefront-components / medusa-plugins packages. */
const segmentHeroFixture = {
  version: "1",
  fields: [
    {
      id: "variant",
      type: "select",
      label: "Layout",
      options: ["overlay", "split"],
      default: "overlay",
    },
  ],
}

describe("BuilderSettingsSchema", () => {
  it("validates a representative segment settings object", () => {
    expect(() => BuilderSettingsSchema.parse(segmentHeroFixture)).not.toThrow()
  })

  it("validates empty settings", () => {
    expect(() => BuilderSettingsSchema.parse({ version: "1", fields: [] })).not.toThrow()
  })
})
