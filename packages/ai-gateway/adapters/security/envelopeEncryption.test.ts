import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { encryptSecret, decryptSecret, isEncrypted, maskSecret } from "./envelopeEncryption.js"

describe("Envelope Encryption", () => {
  beforeEach(() => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "test-encryption-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should refuse to run without a configured key", () => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "")
    expect(() => encryptSecret("sk-test")).toThrow("GATEWAY_ENCRYPTION_KEY")
  })

  it("should encrypt and decrypt secrets accurately", () => {
    const secret = "sk-ant-api03-abcdef1234567890-XYZ"
    const encrypted = encryptSecret(secret)

    expect(isEncrypted(encrypted)).toBe(true)
    expect(encrypted.startsWith("enc:v1:")).toBe(true)
    expect(encrypted).not.toContain(secret)

    const decrypted = decryptSecret(encrypted)
    expect(decrypted).toBe(secret)
  })

  it("should produce different ciphertexts for the same secret (random salt & IV)", () => {
    const secret = "test-secret-123"
    const enc1 = encryptSecret(secret)
    const enc2 = encryptSecret(secret)

    expect(enc1).not.toBe(enc2)
    expect(decryptSecret(enc1)).toBe(secret)
    expect(decryptSecret(enc2)).toBe(secret)
  })

  it("should fail decryption when ciphertext or tag is tampered with", () => {
    const secret = "top-secret-key"
    const encrypted = encryptSecret(secret)
    const parts = encrypted.split(":")
    // Tamper with the ciphertext byte
    const ciphertext = parts[5] ?? ""
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.endsWith("ff") ? "00" : "ff")
    parts[5] = tamperedCiphertext
    const tampered = parts.join(":")

    expect(() => decryptSecret(tampered)).toThrow("unable to authenticate data")
  })

  it("should mask secrets safely", () => {
    expect(maskSecret("sk-1234567890abcdef")).toBe("sk-1...cdef")
    expect(maskSecret("short")).toBe("********")
  })
})
