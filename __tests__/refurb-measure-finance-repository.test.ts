import { planInput } from "./contracts/refurb-plan-repository-contract"
import { defineFinancialRepositoryContract, defineMeasurementRepositoryContract } from "./contracts/refurb-measure-finance-repository-contract"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"

defineMeasurementRepositoryContract("in memory", async () => ({
  measurements: createInMemoryMeasurementRepository(),
  dealA: "deal-a",
  dealB: "deal-b",
  assessmentA1: "asmt-a1",
  assessmentA2: "asmt-a2",
  assessmentB1: "asmt-b1",
  cleanup: async () => undefined,
}))

defineFinancialRepositoryContract("in memory", async () => {
  const plans = createInMemoryRefurbPlanRepository()
  const env = { plans, dealA: "deal-a", dealB: "deal-b", assessmentA1: "asmt-a1", assessmentA2: "asmt-a2", assessmentB1: "asmt-b1", cleanup: async () => undefined }
  const mk = async (dealId: string, assessmentId: string, key: string) => {
    const r = await plans.create(planInput(env, { dealId, assessmentId, idempotencyKey: key }))
    return r.status === "created" ? r.record.id : ""
  }
  return {
    proposals: createInMemoryFinancialRepository(),
    dealA: "deal-a",
    dealB: "deal-b",
    assessmentA1: "asmt-a1",
    assessmentB1: "asmt-b1",
    planA1: await mk("deal-a", "asmt-a1", "plan-key-0001"),
    planA1b: await mk("deal-a", "asmt-a1", "plan-key-0002"),
    planB1: await mk("deal-b", "asmt-b1", "plan-key-0001"),
    cleanup: async () => undefined,
  }
})

