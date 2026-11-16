import type { CreditReservation } from "../domain/entities/usage.js"
import type { UsageLedger } from "../domain/ports/repositories.js"

export class QuotaService {
  constructor(private usageLedger: UsageLedger) {}

  async reserveCredits(
    tenantId: string,
    requestId: string,
    estimatedCredits = 0.05,
  ): Promise<CreditReservation> {
    const reservation: CreditReservation = {
      id: `res_${Math.random().toString(36).slice(2, 10)}`,
      tenantId,
      requestId,
      estimatedCredits,
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min TTL
      status: "reserved",
    }

    await this.usageLedger.createReservation(reservation)
    return reservation
  }

  async settleCredits(requestId: string, actualCostUsd: number): Promise<void> {
    await this.usageLedger.settleReservation(requestId, actualCostUsd)
  }

  async releaseCredits(requestId: string): Promise<void> {
    await this.usageLedger.releaseReservation(requestId)
  }
}
