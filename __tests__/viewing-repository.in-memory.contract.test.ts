import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { defineViewingRepositoryContract } from "./contracts/viewing-repository-contract"

defineViewingRepositoryContract("in-memory test double", async () => ({
  repo: createInMemoryViewingRepository().repo,
  dealA: "deal-a",
  dealB: "deal-b",
  cleanup: async () => undefined,
}))
