import { describe, it, expect } from "vitest"
import { BuilderSettingsSchema } from "./index"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pilotDir = join(__dirname, "../../data/pilot")

describe("builder.settings.json pilot schemas", () => {
  const files = [
    "segment-hero.builder.settings.json",
    "segment-nav.builder.settings.json",
    "medusa-plugin-dynamic-config.builder.settings.json",
  ]

  for (const file of files) {
    it(`validates ${file}`, () => {
      const raw = JSON.parse(readFileSync(join(pilotDir, file), "utf8"))
      expect(() => BuilderSettingsSchema.parse(raw)).not.toThrow()
    })
  }
})
