import { vi } from "vitest"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { makeDeal } from "./fixtures/refurb-seed"
import { __setRefurbDepsForTests } from "@/lib/refurb-integration/deps"
import { defineUnifiedE2EFlow } from "./contracts/viewing-unified-e2e-flow"

// In-memory execution of the unified 10-stage end-to-end viewing integration.
// Runs the real route handlers, real access guard (test identity + operator membership),
// real fixture AI ("complete_flow"), real scope mapping, measurements, financial proposals,
// builder pack, and Deal Passport against in-memory repository contracts.

const h = vi.hoisted(() => ({
  repo: null as unknown,
  deals: new Map<string, ReturnType<typeof makeDeal>>(),
}))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: async (id: string) => h.deals.get(id) ?? null,
}))

defineUnifiedE2EFlow("in-memory repository", async () => {
  const viewing = createInMemoryViewingRepository().repo
  h.repo = viewing
  const plans = createInMemoryRefurbPlanRepository()
  const measurements = createInMemoryMeasurementRepository()
  const proposals = createInMemoryFinancialRepository()

  const dealA = makeDeal("deal-unified-1", {
    address: "14 Example Road, Leeds",
    purchase_price: 100000,
    gdv_realistic: 190000,
    refurb_cost: 25000,
  })
  const dealB = makeDeal("deal-unified-2", {
    address: "9 Other Street, Manchester",
    purchase_price: 120000,
    gdv_realistic: 210000,
    refurb_cost: 30000,
  })

  h.deals = new Map([
    ["deal-unified-1", dealA],
    ["deal-unified-2", dealB],
  ])

  const pack = (dealId: string) => ({
    ...structuredClone(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE),
    meta: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta, savedDealId: dealId },
    identity: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.identity, dealId, address: h.deals.get(dealId)?.address ?? "" },
  })

  __setRefurbDepsForTests({
    viewing,
    plans,
    measurements,
    proposals,
    getDeal: async (id: string) => h.deals.get(id) ?? null,
    loadPack: async (dealId: string) => (h.deals.has(dealId) ? pack(dealId) : null),
    now: () => new Date("2026-10-22T10:00:00.000Z"),
  })

  return {
    dealId: "deal-unified-1",
    otherDealId: "deal-unified-2",
    snapshot: async (id: string) => JSON.stringify({ deal: h.deals.get(id), shield: pack(id).investorShield }),
    cleanup: async () => {
      __setRefurbDepsForTests(undefined)
    },
  }
})
