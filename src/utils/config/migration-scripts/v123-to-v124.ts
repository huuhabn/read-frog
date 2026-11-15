/**
 * Migration from v123 to v124. This is a frozen snapshot: it deliberately
 * imports nothing from application code.
 */
export function migrate(oldConfig: any): any {
  if (oldConfig === null || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }
  if (oldConfig.aiGateway !== undefined) return oldConfig
  return {
    ...oldConfig,
    aiGateway: {
      enabled: true,
      maxAttempts: 3,
      excludedProviderIds: [],
    },
  }
}
