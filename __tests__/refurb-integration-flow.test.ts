import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { defineRefurbIntegrationFlow } from "./contracts/refurb-integration-flow"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { makeDeal } from "./fixtures/refurb-seed"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"

// In-memory run of the shared flow: real services and repositories' contracts, deal and evidence-pack data supplied by
// fixtures. The same assertions run against real PostgreSQL in __tests__/postgres/refurb-integration.pg.test.ts.

defineRefurbIntegrationFlow("in memory", async () => {
  const { repo: viewing } = createInMemoryViewingRepository()
  const plans = createInMemoryRefurbPlanRepository()
  const deals = new Map([
    ["deal-a", makeDeal("deal-a")],
    ["deal-b", makeDeal("deal-b", { address: "9 Other Street" })],
  ])
  const pack = (dealId: string): PdfEvidencePack => ({
    ...structuredClone(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE),
    meta: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta, savedDealId: dealId },
    identity: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.identity, dealId, address: deals.get(dealId)?.address ?? "" },
  })
  return {
    viewing,
    plans,
    measurements: createInMemoryMeasurementRepository(),
    proposals: createInMemoryFinancialRepository(),
    changeDeal: async (id, patch) => {
      const d = deals.get(id)!
      deals.set(id, { ...d, ...patch, updated_at: new Date(Date.parse(d.updated_at) + 60_000).toISOString() })
    },
    dealA: "deal-a",
    dealB: "deal-b",
    getDeal: async (id) => structuredClone(deals.get(id) ?? null),
    loadPack: async (dealId) => (deals.has(dealId) ? pack(dealId) : null),
    snapshot: async (id) => JSON.stringify({ deal: deals.get(id), shield: pack(id).investorShield }),
    cleanup: async () => undefined,
  }
})
