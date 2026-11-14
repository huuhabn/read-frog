import { describe, expect, it } from "vitest"
import { maskPII } from "../mask"
import { unmaskPII } from "../unmask"

describe("PII Masking & Unmasking", () => {
  it("should mask phone numbers in Vietnamese format", () => {
    const input = "Số điện thoại của mình là 0912345678, gọi lại nhé!"
    const { masked, map, piiCount } = maskPII(input)

    expect(masked).toContain("[PHONE_1]")
    expect(masked).not.toContain("0912345678")
    expect(map["[PHONE_1]"]).toBe("0912345678")
    expect(piiCount).toBe(1)

    const unmasked = unmaskPII(masked, map)
    expect(unmasked).toBe(input)
  })

  it("should mask email addresses", () => {
    const input = "Gửi tài liệu vào email contact@example.com hoặc dev.team@company.vn nha."
    const { masked, map } = maskPII(input)

    expect(masked).toContain("[EMAIL_1]")
    expect(masked).toContain("[EMAIL_2]")
    expect(map["[EMAIL_1]"]).toBe("contact@example.com")
    expect(map["[EMAIL_2]"]).toBe("dev.team@company.vn")

    const unmasked = unmaskPII(masked, map)
    expect(unmasked).toBe(input)
  })

  it("should mask bank account numbers with prefix", () => {
    const input = "Chuyển tiền vào STK: 19034567891234 Techcombank"
    const { masked, map } = maskPII(input)

    expect(masked).toContain("[STK_1]")
    expect(masked).not.toContain("19034567891234")
    expect(map["[STK_1]"]).toBe("19034567891234")

    const unmasked = unmaskPII(masked, map)
    expect(unmasked).toBe(input)
  })

  it("should mask CCCD numbers", () => {
    const input = "Số CCCD của tôi là 001234567890 (căn cước mới)"
    const { masked, map } = maskPII(input)

    expect(masked).toContain("[CCCD_1]")
    expect(masked).not.toContain("001234567890")
    expect(map["[CCCD_1]"]).toBe("001234567890")

    const unmasked = unmaskPII(masked, map)
    expect(unmasked).toBe(input)
  })

  it("should preserve identity of repeated PII when preserveIdentity is true", () => {
    const input = "Anh gọi 0987654321, nhớ là 0987654321 nhé!"
    const { masked, map, piiCount } = maskPII(input, { preserveIdentity: true })

    expect(masked).toBe("Anh gọi [PHONE_1], nhớ là [PHONE_1] nhé!")
    expect(piiCount).toBe(1)

    const unmasked = unmaskPII(masked, map)
    expect(unmasked).toBe(input)
  })

  it("should handle empty or null string gracefully", () => {
    expect(maskPII("")).toEqual({ masked: "", map: {}, piiCount: 0 })
    expect(unmaskPII("", {})).toBe("")
  })
})
