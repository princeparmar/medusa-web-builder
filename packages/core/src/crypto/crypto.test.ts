import { describe, it, expect, beforeAll } from "vitest"
import { encrypt, decrypt } from "./index"

describe("crypto", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-min!!"
  })

  it("encrypts and decrypts", () => {
    const plain = "secret-admin-token"
    const enc = encrypt(plain)
    expect(enc).not.toBe(plain)
    expect(decrypt(enc)).toBe(plain)
  })
})
