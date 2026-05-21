import { describe, expect, it } from "vitest"
import type {
  CreateDealSnapshotInput,
  CreateOperatorDealInput,
  OperatorCommandRepository,
  RecordPipelineEventInput,
  UpdateOperatorDealMetadataInput,
} from "@/lib/operator-command/operator-command-repository"
import {
  DEAL_SNAPSHOT_FIXTURE,
  OPERATOR_DEAL_FIXTURE,
  PIPELINE_EVENT_FIXTURE,
} from "./fixtures/operator-command/operator-command-fixtures"

describe("Phase 4A repository adapter interface contracts", () => {
  it("typed object satisfies OperatorCommandRepository shape", async () => {
    const repository: OperatorCommandRepository = {
      async createOperatorDeal(input: CreateOperatorDealInput) {
        void input
        return OPERATOR_DEAL_FIXTURE
      },
      async getOperatorDealById(id: string) {
        void id
        return null
      },
      async updateOperatorDealMetadata(id: string, input: UpdateOperatorDealMetadataInput) {
        void id
        void input
        return OPERATOR_DEAL_FIXTURE
      },
      async archiveOperatorDeal(id: string) {
        void id
        return { ...OPERATOR_DEAL_FIXTURE, archived_at: "2026-01-20T00:00:00.000Z" }
      },
      async createDealSnapshot(input: CreateDealSnapshotInput) {
        void input
        return DEAL_SNAPSHOT_FIXTURE
      },
      async getLatestDealSnapshot(dealId: string) {
        void dealId
        return DEAL_SNAPSHOT_FIXTURE
      },
      async recordPipelineEvent(input: RecordPipelineEventInput) {
        void input
        return PIPELINE_EVENT_FIXTURE
      },
    }

    const createdDeal = await repository.createOperatorDeal({
      address: OPERATOR_DEAL_FIXTURE.address,
      source_url: OPERATOR_DEAL_FIXTURE.source_url,
      pipeline_state: OPERATOR_DEAL_FIXTURE.pipeline_state,
      governance_state: OPERATOR_DEAL_FIXTURE.governance_state,
      classification: OPERATOR_DEAL_FIXTURE.classification,
      notes: OPERATOR_DEAL_FIXTURE.notes,
    })

    const maybeDeal = await repository.getOperatorDealById(OPERATOR_DEAL_FIXTURE.id)

    const createdSnapshot = await repository.createDealSnapshot({
      deal_id: DEAL_SNAPSHOT_FIXTURE.deal_id,
      engine_snapshot_json: DEAL_SNAPSHOT_FIXTURE.engine_snapshot_json,
    })

    const recordedPipelineEvent = await repository.recordPipelineEvent({
      deal_id: PIPELINE_EVENT_FIXTURE.deal_id,
      from_state: PIPELINE_EVENT_FIXTURE.from_state,
      to_state: PIPELINE_EVENT_FIXTURE.to_state,
      reason: PIPELINE_EVENT_FIXTURE.reason,
      blocked: PIPELINE_EVENT_FIXTURE.blocked,
      block_reason: PIPELINE_EVENT_FIXTURE.block_reason,
    })

    expect(createdDeal.id).toBe(OPERATOR_DEAL_FIXTURE.id)
    expect(maybeDeal).toBeNull()
    expect(createdSnapshot.id).toBe(DEAL_SNAPSHOT_FIXTURE.id)
    expect(recordedPipelineEvent.id).toBe(PIPELINE_EVENT_FIXTURE.id)

    const serialized = JSON.stringify({
      createdDeal,
      maybeDeal,
      createdSnapshot,
      recordedPipelineEvent,
    })

    const forbiddenKeys = ["apiUrl", "database", "aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]
    for (const forbidden of forbiddenKeys) {
      expect(serialized).not.toContain(`"${forbidden}"`)
    }
  })
})
