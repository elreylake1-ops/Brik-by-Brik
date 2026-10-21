import { FINANCIAL_DECISIONS, type FinancialDecision } from "@/types/refurb-financial"
import type { Parsed } from "./plan-request-validation"

// Strict parsing for the financial-proposal endpoints. A request can carry a choice and acknowledgements, never a figure,
// a verdict, a reviewer or a deal value. Unknown fields are rejected.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const MAX_NOTE = 500

const unknownKeys = (body: Record<string, unknown>, allowed: readonly string[]) => Object.keys(body).filter((k) => !allowed.includes(k)).map((k) => `Unknown field: ${k}`)

export type ProposalRequest = { idempotencyKey: string }

export function parseProposalRequest(body: unknown): Parsed<ProposalRequest> {
  if (!isObject(body)) return { ok: false, errors: ["Body must be a JSON object"] }
  const errors = unknownKeys(body, ["idempotencyKey"])
  if (typeof body.idempotencyKey !== "string" || !KEY_PATTERN.test(body.idempotencyKey)) errors.push("idempotencyKey must be 8-100 characters of A-Z a-z 0-9 _ -")
  return errors.length ? { ok: false, errors } : { ok: true, value: { idempotencyKey: body.idempotencyKey as string } }
}

export type DecisionRequest = {
  idempotencyKey: string
  decision: FinancialDecision
  /** The content hash of the proposal the operator was looking at. */
  proposalHash: string
  note: string | null
  acknowledge: { notWriteBack: boolean; exclusions: boolean; unresolvedQuantities: boolean }
}

export function parseDecisionRequest(body: unknown): Parsed<DecisionRequest> {
  if (!isObject(body)) return { ok: false, errors: ["Body must be a JSON object"] }
  const errors = unknownKeys(body, ["idempotencyKey", "decision", "proposalHash", "note", "acknowledge"])
  if (typeof body.idempotencyKey !== "string" || !KEY_PATTERN.test(body.idempotencyKey)) errors.push("idempotencyKey must be 8-100 characters of A-Z a-z 0-9 _ -")
  if (typeof body.decision !== "string" || !FINANCIAL_DECISIONS.includes(body.decision as FinancialDecision)) errors.push("decision must be CONFIRMED or DECLINED")
  if (typeof body.proposalHash !== "string" || !HASH_PATTERN.test(body.proposalHash)) errors.push("proposalHash must be the hash of the proposal that was reviewed")
  let note: string | null = null
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > MAX_NOTE || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.note)) errors.push(`note must be text of at most ${MAX_NOTE} characters`)
    else note = body.note.trim() || null
  }
  const ack = isObject(body.acknowledge) ? body.acknowledge : null
  const acknowledge = { notWriteBack: false, exclusions: false, unresolvedQuantities: false }
  if (!ack) errors.push("acknowledge must state what was understood")
  else {
    errors.push(...unknownKeys(ack, ["notWriteBack", "exclusions", "unresolvedQuantities"]).map((e) => `acknowledge: ${e}`))
    for (const k of ["notWriteBack", "exclusions", "unresolvedQuantities"] as const) {
      if (ack[k] !== undefined && typeof ack[k] !== "boolean") errors.push(`acknowledge.${k} must be true or false`)
      else acknowledge[k] = ack[k] === true
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { idempotencyKey: body.idempotencyKey as string, decision: body.decision as FinancialDecision, proposalHash: body.proposalHash as string, note, acknowledge } }
}
