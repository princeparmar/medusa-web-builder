import { describe, expect, it } from "vitest"
import { compileOptionsWithBindings, suggestStorage } from "./bindings"
import type { BuilderField } from "./types"

describe("bindings", () => {
  it("suggests github-secret for sensitive fields", () => {
    const field: BuilderField = { id: "apiKey", type: "short-text", sensitive: true }
    expect(suggestStorage(field)).toBe("github-secret")
  })

  it("compiles env references for secrets", () => {
    const fields: BuilderField[] = [{ id: "smtpHost", type: "short-text" }]
    const out = compileOptionsWithBindings(
      {},
      { smtpHost: { storage: "github-variable", name: "SMTP_HOST" } },
      fields
    )
    expect(out.smtpHost).toBe("process.env.SMTP_HOST")
  })
})
