import { describe, expect, it } from "vitest"
import {
  AUDIT_EVENT_FIXTURE,
  DEAL_SNAPSHOT_FIXTURE,
  EVIDENCE_ITEM_FIXTURE,
  OFFER_RECORD_FIXTURE,
  OPERATOR_DEAL_FIXTURE,
  OPERATOR_TASK_FIXTURE,
  PIPELINE_EVENT_FIXTURE,
} from "./fixtures/operator-command/operator-command-fixtures"

describe("Phase 4A operator command contract fixtures", () => {
  it("fixture ids are present", () => {
    expect(OPERATOR_DEAL_FIXTURE.id.length).toBeGreaterThan(0)
    expect(DEAL_SNAPSHOT_FIXTURE.id.length).toBeGreaterThan(0)
    expect(PIPELINE_EVENT_FIXTURE.id.length).toBeGreaterThan(0)
    expect(OFFER_RECORD_FIXTURE.id.length).toBeGreaterThan(0)
    expect(OPERATOR_TASK_FIXTURE.id.length).toBeGreaterThan(0)
    expect(EVIDENCE_ITEM_FIXTURE.id.length).toBeGreaterThan(0)
    expect(AUDIT_EVENT_FIXTURE.id.length).toBeGreaterThan(0)
  })

  it("deal_id references match the sample deal id", () => {
    const dealId = OPERATOR_DEAL_FIXTURE.id
    expect(DEAL_SNAPSHOT_FIXTURE.deal_id).toBe(dealId)
    expect(PIPELINE_EVENT_FIXTURE.deal_id).toBe(dealId)
    expect(OFFER_RECORD_FIXTURE.deal_id).toBe(dealId)
    expect(OPERATOR_TASK_FIXTURE.deal_id).toBe(dealId)
    expect(EVIDENCE_ITEM_FIXTURE.deal_id).toBe(dealId)
    expect(AUDIT_EVENT_FIXTURE.deal_id).toBe(dealId)
  })

  it("snapshot has engine_snapshot_json", () => {
    expect(DEAL_SNAPSHOT_FIXTURE.engine_snapshot_json).toBeDefined()
    expect(typeof DEAL_SNAPSHOT_FIXTURE.engine_snapshot_json).toBe("object")
  })

  it("pipeline event has from_state and to_state", () => {
    expect(PIPELINE_EVENT_FIXTURE.from_state.length).toBeGreaterThan(0)
    expect(PIPELINE_EVENT_FIXTURE.to_state.length).toBeGreaterThan(0)
  })

  it("offer has offer_amount and response_status", () => {
    expect(OFFER_RECORD_FIXTURE.offer_amount).toBeGreaterThan(0)
    expect(OFFER_RECORD_FIXTURE.response_status.length).toBeGreaterThan(0)
  })

  it("task has status and priority", () => {
    expect(OPERATOR_TASK_FIXTURE.status.length).toBeGreaterThan(0)
    expect(OPERATOR_TASK_FIXTURE.priority.length).toBeGreaterThan(0)
  })

  it("evidence item has category", () => {
    expect(EVIDENCE_ITEM_FIXTURE.category.length).toBeGreaterThan(0)
  })

  it("audit event has event_type", () => {
    expect(AUDIT_EVENT_FIXTURE.event_type.length).toBeGreaterThan(0)
  })

  it("no fixture contains forbidden runtime behavior keys", () => {
    const forbiddenKeys = ["apiUrl", "database", "aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]
    const fixtures = [
      OPERATOR_DEAL_FIXTURE,
      DEAL_SNAPSHOT_FIXTURE,
      PIPELINE_EVENT_FIXTURE,
      OFFER_RECORD_FIXTURE,
      OPERATOR_TASK_FIXTURE,
      EVIDENCE_ITEM_FIXTURE,
      AUDIT_EVENT_FIXTURE,
    ]

    for (const fixture of fixtures) {
      const serialized = JSON.stringify(fixture)
      for (const forbiddenKey of forbiddenKeys) {
        expect(serialized).not.toContain(`"${forbiddenKey}"`)
      }
    }
  })
})
