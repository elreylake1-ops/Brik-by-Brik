import type { FinancialDecisionEvent, FinancialProposalRecord } from "@/types/refurb-financial"

// Persistence boundary for financial-impact proposals and the decisions about them. Append-only. Every read is keyed by
// deal AND assessment. Nothing here can touch a Saved Deal: the interface has no such operation.

export type NewFinancialProposal = Omit<FinancialProposalRecord, "id" | "version">
export type NewFinancialDecision = Omit<FinancialDecisionEvent, "id">

export type CreateProposalResult =
  | { status: "created"; record: FinancialProposalRecord }
  | { status: "replayed"; record: FinancialProposalRecord } // identical content for the same plan already exists

export type AppendDecisionResult =
  | { status: "created"; event: FinancialDecisionEvent }
  | { status: "replayed"; event: FinancialDecisionEvent } // same key, same request
  | { status: "key_reused" } // same key, different request
  | { status: "already_decided"; event: FinancialDecisionEvent } // a decision exists (any key): one decision per proposal

export type FinancialProposalRepository = {
  createProposal(input: NewFinancialProposal): Promise<CreateProposalResult>
  getProposal(dealId: string, assessmentId: string, proposalId: string): Promise<FinancialProposalRecord | null>
  /** All proposals, newest first. */
  listProposals(dealId: string, assessmentId: string): Promise<FinancialProposalRecord[]>
  getDecision(dealId: string, assessmentId: string, proposalId: string): Promise<FinancialDecisionEvent | null>
  appendDecision(input: NewFinancialDecision): Promise<AppendDecisionResult>
}
