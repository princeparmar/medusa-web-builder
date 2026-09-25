import { describe, expect, it, vi, afterEach } from "vitest"
import { assertNpmPackageVersion, fetchNpmPackageInfo } from "./npm"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("fetchNpmPackageInfo", () => {
  it("returns package versions when npm responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          name: "@scope/pkg",
          versions: { "1.0.0": {}, "1.1.0": {} },
          "dist-tags": { latest: "1.1.0" },
        }),
      })
    )

    const info = await fetchNpmPackageInfo("@scope/pkg")
    expect(info).toEqual({
      name: "@scope/pkg",
      versions: ["1.0.0", "1.1.0"],
      latest: "1.1.0",
    })
  })

  it("returns null when package is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    )

    expect(await fetchNpmPackageInfo("missing-pkg")).toBeNull()
  })
})

describe("assertNpmPackageVersion", () => {
  it("accepts a published version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          name: "demo-pkg",
          versions: { "0.2.0": {}, "0.3.0": {} },
          "dist-tags": { latest: "0.3.0" },
        }),
      })
    )

    const result = await assertNpmPackageVersion("demo-pkg", "0.2.0")
    expect(result).toEqual({ ok: true, packageName: "demo-pkg", version: "0.2.0" })
  })

  it("rejects a missing package", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    )

    const result = await assertNpmPackageVersion("no-such-pkg", "1.0.0")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("not found")
    }
  })

  it("rejects a missing version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          name: "demo-pkg",
          versions: { "1.0.0": {} },
          "dist-tags": { latest: "1.0.0" },
        }),
      })
    )

    const result = await assertNpmPackageVersion("demo-pkg", "9.9.9")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("not published")
    }
  })
})
