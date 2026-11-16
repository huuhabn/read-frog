import type { SecretCipher } from "../../domain/ports/secretCipher.js"
import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits standard for GCM
const SALT_LENGTH = 16
const TAG_LENGTH = 16
const PREFIX = "enc:v1"

function getMasterKey(customKeyHex?: string): Buffer {
  const hex = customKeyHex || process.env.GATEWAY_ENCRYPTION_KEY
  if (!hex) {
    throw new Error("GATEWAY_ENCRYPTION_KEY is not set; refusing to encrypt or decrypt credentials")
  }
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex")
  }
  // If passphrase provided instead of 32-byte hex, derive 32-byte key via sha256
  return crypto.createHash("sha256").update(hex).digest()
}

/**
 * Encrypt a plaintext secret using AES-256-GCM.
 * Output format: enc:v1:<salt_hex>:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string, customKeyHex?: string): string {
  if (!plaintext) return ""
  const masterKey = getMasterKey(customKeyHex)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)

  // Derive per-record key using HKDF
  const recordKey = crypto.hkdfSync(
    "sha256",
    masterKey,
    salt,
    Buffer.from("gateway-credential-envelope"),
    32,
  )

  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(recordKey), iv, {
    authTagLength: TAG_LENGTH,
  })

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}:${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`
}

/**
 * Decrypt a secret produced by encryptSecret.
 */
export function decryptSecret(encryptedStr: string, customKeyHex?: string): string {
  if (!encryptedStr) return ""
  if (!isEncrypted(encryptedStr)) {
    // Return as-is if unencrypted (e.g. legacy or dev plaintext)
    return encryptedStr
  }

  const [enc, version, saltHex, ivHex, tagHex, ciphertextHex, ...rest] = encryptedStr.split(":")
  if (
    enc !== "enc" ||
    version !== "v1" ||
    saltHex === undefined ||
    ivHex === undefined ||
    tagHex === undefined ||
    ciphertextHex === undefined ||
    rest.length > 0
  ) {
    throw new Error("Invalid encrypted secret format")
  }

  const masterKey = getMasterKey(customKeyHex)
  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ciphertext = Buffer.from(ciphertextHex, "hex")

  const recordKey = crypto.hkdfSync(
    "sha256",
    masterKey,
    salt,
    Buffer.from("gateway-credential-envelope"),
    32,
  )

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(recordKey), iv, {
    authTagLength: TAG_LENGTH,
  })
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}

export function createEnvelopeCipher(customKeyHex?: string): SecretCipher {
  return {
    encrypt: (plaintext) => encryptSecret(plaintext, customKeyHex),
    decrypt: (stored) => decryptSecret(stored, customKeyHex),
  }
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`)
}

/**
 * Mask secret for safe display (e.g. "sk-abc...1234").
 */
export function maskSecret(secret: string): string {
  if (!secret) return ""
  const plain = isEncrypted(secret) ? "********" : secret
  if (plain.length <= 8) return "********"
  const start = plain.slice(0, 4)
  const end = plain.slice(-4)
  return `${start}...${end}`
}
