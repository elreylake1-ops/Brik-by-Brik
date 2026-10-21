import { randomUUID } from "node:crypto"
import type { FinancialProposalRepository } from "@/lib/refurb-integration/financial-proposal-repository"
import type { FinancialDecisionEvent, FinancialProposalRecord } from "@/types/refurb-financial"

// Behavioural double for the financial-proposal repository (same contract as the PostgreSQL implementation).
export function createInMemoryFinancialRepository(): FinancialProposalRepository & { proposals: FinancialProposalRecord[]; decisions: FinancialDecisionEvent[] } {
  const proposals: FinancialProposalRecord[] = []
  const decisions: FinancialDecisionEvent[] = []
  const clone = <T,>(v: T): T => structuredClone(v)
  const mine = (d: string, a: string) => proposals.filter((p) => p.dealId === d && p.assessmentId === a)
  return {
    proposals,
    decisions,
    async createProposal(input) {
      const same = mine(input.dealId, input.assessmentId).find((p) => p.planId === input.planId && p.contentHash === input.contentHash)
      if (same) return { status: "replayed", record: clone(same) }
      const record: FinancialProposalRecord = { ...clone(input), id: `fprop-${randomUUID()}`, version: mine(input.dealId, input.assessmentId).length + 1 }
      proposals.push(record)
      return { status: "created", record: clone(record) }
    },
    async getProposal(d, a, id) {
      const p = mine(d, a).find((x) => x.id === id)
      return p ? clone(p) : null
    },
    async listProposals(d, a) {
      return mine(d, a).map(clone).reverse()
    },
    async getDecision(d, a, proposalId) {
      const e = decisions.find((x) => x.dealId === d && x.assessmentId === a && x.proposalId === proposalId)
      return e ? clone(e) : null
    },
    async appendDecision(input) {
      const existing = decisions.find((x) => x.dealId === input.dealId && x.assessmentId === input.assessmentId && x.proposalId === input.proposalId)
      if (existing) {
        if (existing.idempotencyKey !== input.idempotencyKey) return { status: "already_decided", event: clone(existing) }
        return existing.requestHash === input.requestHash ? { status: "replayed", event: clone(existing) } : { status: "key_reused" }
      }
      if (!proposals.some((p) => p.dealId === input.dealId && p.assessmentId === input.assessmentId && p.id === input.proposalId)) throw new Error("foreign key: proposal does not exist in this deal and assessment")
      const event: FinancialDecisionEvent = { ...clone(input), id: `fdec-${randomUUID()}` }
      decisions.push(event)
      return { status: "created", event: clone(event) }
    },
  }
}
