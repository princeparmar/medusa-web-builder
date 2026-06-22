import { describe, it, expect } from "vitest"
import { hasPermission, hasMinRole } from "./index"

describe("RBAC", () => {
  it("OWNER can delete project", () => {
    expect(hasPermission("OWNER", "project:delete")).toBe(true)
  })

  it("DEVELOPER cannot publish", () => {
    expect(hasPermission("DEVELOPER", "project:publish")).toBe(false)
  })

  it("MANAGER can invite", () => {
    expect(hasPermission("MANAGER", "project:invite")).toBe(true)
  })

  it("role hierarchy", () => {
    expect(hasMinRole("OWNER", "MANAGER")).toBe(true)
    expect(hasMinRole("VIEWER", "DEVELOPER")).toBe(false)
  })
})
