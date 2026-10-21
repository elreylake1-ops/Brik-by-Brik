import { vi } from "vitest"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { defineVideoFlow } from "./contracts/viewing-video-flow"

// In-memory run of the end-to-end flow. The access guard and identity boundary are the REAL ones (not mocked);
// only storage of records (in-memory repository) and the saved-deal lookup are substituted.

const h = vi.hoisted(() => ({ repo: null as unknown }))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: async (id: string) => (["deal-1", "deal-2"].includes(id) ? { id } : null),
}))

defineVideoFlow("in-memory repository", async () => {
  h.repo = createInMemoryViewingRepository().repo
  return { dealId: "deal-1", otherDealId: "deal-2", cleanup: async () => undefined }
})
