import { definePlanRepositoryContract } from "./contracts/refurb-plan-repository-contract"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"

definePlanRepositoryContract("in memory", async () => ({
  plans: createInMemoryRefurbPlanRepository(),
  dealA: "deal-a",
  dealB: "deal-b",
  assessmentA1: "asmt-a1",
  assessmentA2: "asmt-a2",
  assessmentB1: "asmt-b1",
  cleanup: async () => undefined,
}))
