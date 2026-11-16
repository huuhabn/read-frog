import type { AuditService } from "../../application/auditService.js"
import type { ProviderCredential } from "../../domain/entities/credential.js"
import type {
  TenantRepository,
  CredentialRepository,
  UsageLedger,
} from "../../domain/ports/repositories.js"
import { Hono } from "hono"
import { encryptSecret, maskSecret } from "../../adapters/security/envelopeEncryption.js"

export function createManagementRoutes(
  tenantRepo: TenantRepository,
  credentialRepo: CredentialRepository,
  usageLedger: UsageLedger,
  auditService: AuditService,
) {
  const router = new Hono()

  // Admin: Create tenant
  router.post("/v1/admin/tenants", async (c: any) => {
    const body = await c.req.json()
    const id = body.id || `tenant_${Date.now()}`
    const tenant = {
      id,
      name: body.name || "Default Tenant",
      slug: body.slug || id,
      status: "active" as const,
      credentialMode: body.credentialMode || "hybrid",
      allowedProviders: body.allowedProviders || [],
      allowedModels: body.allowedModels || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await tenantRepo.saveTenant(tenant)

    // Record audit log
    await auditService.logEvent({
      tenantId: tenant.id,
      actorId: "platform_admin",
      actorType: "admin",
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenant.id,
      changes: { new: tenant },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    })

    return c.json({ success: true, tenant }, 201)
  })

  // Tenant: Add or update BYOK credential
  router.post("/v1/tenant/credentials", async (c: any) => {
    const body = await c.req.json()
    const tenant = c.get("tenant")
    const tenantId = tenant ? tenant.id : body.tenantId || "default"

    if (!body.provider || !body.apiKey) {
      return c.json({ error: { message: "Provider and apiKey are required" } }, 400)
    }

    const encryptedSecret = encryptSecret(body.apiKey)
    const masked = maskSecret(body.apiKey)
    const credentialId = body.id || `cred_${Date.now()}`

    const cred: ProviderCredential = {
      id: credentialId,
      scope: "tenant",
      tenantId,
      provider: body.provider.toLowerCase(),
      label: body.label || `${body.provider} BYOK Key`,
      encryptedSecret,
      maskedSecret: masked,
      baseUrl: body.baseUrl,
      organizationId: body.organizationId,
      projectId: body.projectId,
      isEnabled: true,
      priority: body.priority || 10,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await credentialRepo.saveCredential(cred)

    // Record audit log
    await auditService.logEvent({
      tenantId,
      actorId: tenant ? `tenant_${tenant.id}` : "tenant_user",
      actorType: "tenant",
      action: "credential.create",
      resourceType: "credential",
      resourceId: cred.id,
      changes: {
        provider: cred.provider,
        label: cred.label,
        maskedSecret: cred.maskedSecret,
      },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    })

    // Return write-only safe representation (never return raw secret or ciphertext)
    return c.json(
      {
        success: true,
        credential: {
          id: cred.id,
          provider: cred.provider,
          label: cred.label,
          maskedSecret: cred.maskedSecret,
          scope: cred.scope,
          isEnabled: cred.isEnabled,
        },
      },
      201,
    )
  })

  // Tenant: List BYOK credentials
  router.get("/v1/tenant/credentials", async (c: any) => {
    const tenant = c.get("tenant")
    const tenantId = tenant ? tenant.id : c.req.query("tenantId") || "default"
    const provider = c.req.query("provider") || "openai"

    const list = await credentialRepo.findCredentials({
      provider,
      scope: "tenant",
      tenantId,
    })

    return c.json({
      credentials: list.map((cred) => ({
        id: cred.id,
        provider: cred.provider,
        label: cred.label,
        maskedSecret: cred.maskedSecret,
        isEnabled: cred.isEnabled,
        priority: cred.priority,
      })),
    })
  })

  // Tenant: Usage summary
  router.get("/v1/tenant/usage", async (c: any) => {
    const tenant = c.get("tenant")
    const tenantId = tenant ? tenant.id : c.req.query("tenantId") || "default"
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const to = new Date()

    const summary = await usageLedger.getTenantUsageSummary(tenantId, from, to)
    return c.json({ tenantId, period: { from, to }, summary })
  })

  // Admin: Audit Logs List
  router.get("/v1/admin/audit-logs", async (c: any) => {
    const tenantId = c.req.query("tenantId")
    const resourceType = c.req.query("resourceType")
    const action = c.req.query("action")
    const limit = parseInt(c.req.query("limit") || "50", 10)
    const offset = parseInt(c.req.query("offset") || "0", 10)

    const logs = await auditService.listLogs({
      tenantId,
      resourceType,
      action,
      limit,
      offset,
    })

    return c.json(logs)
  })

  // Tenant: Audit Logs List (scoped to own tenant)
  router.get("/v1/tenant/audit-logs", async (c: any) => {
    const tenant = c.get("tenant")
    const tenantId = tenant ? tenant.id : c.req.query("tenantId") || "default"
    const limit = parseInt(c.req.query("limit") || "50", 10)
    const offset = parseInt(c.req.query("offset") || "0", 10)

    const logs = await auditService.listLogs({
      tenantId,
      limit,
      offset,
    })

    return c.json(logs)
  })

  return router
}
