import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v123-to-v124"

describe("v123-to-v124", () => {
  it("adds automatic routing defaults without changing existing fields", () => {
    const oldConfig = { providersConfig: [{ id: "provider" }], custom: { keep: true } }
    expect(migrate(oldConfig)).toEqual({
      ...oldConfig,
      aiGateway: { enabled: true, maxAttempts: 3, excludedProviderIds: [] },
    })
  })

  it("is idempotent and preserves an existing gateway config", () => {
    const config = {
      aiGateway: { enabled: false, maxAttempts: 1, excludedProviderIds: ["private"] },
    }
    expect(migrate(config)).toBe(config)
    expect(migrate(migrate(config))).toBe(config)
  })

  it.each([null, [], "invalid", 123])("leaves malformed roots unchanged", (value) => {
    expect(migrate(value)).toBe(value)
  })
})
