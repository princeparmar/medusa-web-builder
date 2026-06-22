import { describe, expect, it } from "vitest"
import {
  compileOptionsWithBindings,
  decompileOptionsToForm,
  hydrateConfigFormState,
  countMissingRequiredFields,
  suggestStorage,
} from "./bindings"
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

  it("decompiles process.env references back to form bindings", () => {
    const fields: BuilderField[] = [
      {
        id: "client_id",
        type: "short-text",
        required: true,
        envName: "CASHFREE_CLIENT_ID",
        sensitive: true,
      },
      {
        id: "environment",
        type: "select",
        options: ["sandbox", "production"],
        default: "sandbox",
      },
    ]
    const { values, bindings } = decompileOptionsToForm(
      {
        client_id: "process.env.CASHFREE_CLIENT_ID",
        environment: "sandbox",
      },
      fields
    )
    expect(bindings.client_id).toEqual({
      storage: "github-secret",
      name: "CASHFREE_CLIENT_ID",
    })
    expect(values.client_id).toBe("")
    expect(bindings.environment).toEqual({ storage: "hardcoded", value: "sandbox" })
    expect(values.environment).toBe("sandbox")
  })

  it("hydrates from saved bindings and compiled options", () => {
    const schema = {
      fields: [
        { id: "client_secret", type: "short-text" as const, sensitive: true, envName: "CASHFREE_CLIENT_SECRET" },
      ],
    }
    const hydrated = hydrateConfigFormState(
      schema,
      { client_secret: "process.env.CASHFREE_CLIENT_SECRET" },
      { client_secret: { storage: "github-secret" as const, name: "CASHFREE_CLIENT_SECRET" } }
    )
    expect(hydrated.bindings.client_secret.name).toBe("CASHFREE_CLIENT_SECRET")
    expect(hydrated.values.client_secret).toBe("")
  })

  it("counts missing required fields", () => {
    const schema = {
      fields: [
        { id: "host", type: "short-text" as const, required: true },
        { id: "port", type: "number" as const, default: 465 },
      ],
    }
    const missing = countMissingRequiredFields(
      schema,
      { port: 465 },
      { host: { storage: "github-variable" as const } }
    )
    expect(missing).toBe(1)
  })
})
