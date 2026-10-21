import type { ConfirmedPlanRecord } from "@/types/refurb-integration"

// Persistence boundary for confirmed refurbishment plans. Append-only: a plan is created, read and listed; never edited.
// Every read is keyed by BOTH deal and assessment, so a plan can never be reached through another deal's id.
// One behavioural contract (__tests__/contracts/refurb-plan-repository-contract.ts) runs against the in-memory double
// and the real PostgreSQL implementation.

export type NewPlanConfirmation = Omit<ConfirmedPlanRecord, "id" | "version"> & {
  /** Hash of the confirming request, so a replay can be told apart from a reused key. */
  requestHash: string
}

export type CreatePlanResult =
  | { status: "created"; record: ConfirmedPlanRecord }
  | { status: "replayed"; record: ConfirmedPlanRecord } // same key, same request: the stored result, nothing new written
  | { status: "key_reused" } // same key, different request

export type RefurbPlanRepository = {
  create(input: NewPlanConfirmation): Promise<CreatePlanResult>
  /** The confirmation already stored for this key, with the hash of the request that created it. */
  findByKey(dealId: string, assessmentId: string, idempotencyKey: string): Promise<{ record: ConfirmedPlanRecord; requestHash: string } | null>
  /** Latest confirmation for this assessment of this deal, or null. */
  getCurrent(dealId: string, assessmentId: string): Promise<ConfirmedPlanRecord | null>
  /** All confirmations, newest first. */
  list(dealId: string, assessmentId: string): Promise<ConfirmedPlanRecord[]>
}
