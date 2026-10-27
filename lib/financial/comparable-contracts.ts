import type { VerifiedComparableEvidence } from "./verified-comparable-evidence"
import type { DealSaleComparable, GdvValuationState } from "@/types/financial-comparables"

type Validation = { valid: boolean; eligible: boolean; issues: string[] }
const qualifying = new Set(["LAND_REGISTRY", "SURVEYOR", "SOLICITOR"])
const date = (v: string | undefined) => Boolean(v && !Number.isNaN(Date.parse(v)))
const text = (v: string | undefined) => Boolean(v?.trim())

export function validateComparable(c: DealSaleComparable, asOf: string): Validation {
  const issues: string[] = []
  if (!text(c.id) || !text(c.dealId) || !text(c.evidenceId) || !text(c.propertyAddress) || !text(c.transactionReference) || !text(c.sourceReference)) issues.push("required comparable identity or provenance is missing")
  if (!Number.isFinite(c.salePrice) || c.salePrice <= 0) issues.push("sale price must be positive")
  if (!date(c.saleDate) || !date(asOf)) issues.push("sale or reference date is invalid")
  if (c.reviewState === "REJECTED" && !text(c.rejectionReason)) issues.push("rejected comparable requires a reason")
  if (c.reviewState === "ACCEPTED" && (!text(c.reviewedBy) || !date(c.reviewedAt))) issues.push("accepted comparable requires reviewer and timestamp")
  if (c.reviewState === "ACCEPTED" && c.reviewDueAt && (!date(c.reviewDueAt) || Date.parse(c.reviewDueAt) < Date.parse(asOf))) issues.push("accepted comparable review is stale")
  if (c.reviewState === "ACCEPTED" && text(c.rejectionReason)) issues.push("accepted comparable cannot carry rejection reason")
  const valid = issues.length === 0
  return { valid, eligible: valid && c.reviewState === "ACCEPTED" && qualifying.has(c.sourceType), issues }
}

export function mapComparableToVerifiedEvidence(c: DealSaleComparable): VerifiedComparableEvidence {
  return { evidenceId: c.evidenceId, property: { address: c.propertyAddress, ...(c.postcode ? { postcode: c.postcode } : {}) }, soldPrice: c.salePrice, transactionDate: c.saleDate, transaction: { status: "COMPLETED", reference: c.transactionReference }, source: c.sourceType, sourceReference: c.sourceReference, verification: { status: c.reviewState === "ACCEPTED" ? "CONFIRMED" : c.reviewState === "REJECTED" ? "REJECTED" : "UNVERIFIED", reviewerId: c.reviewedBy ?? null, reviewedAt: c.reviewedAt ?? null, ...(c.reviewDueAt ? { reviewDueAt: c.reviewDueAt } : {}) }, similarity: { ...(c.bedrooms === undefined ? {} : { bedrooms: c.bedrooms }), ...(c.distanceMiles === undefined ? {} : { distanceMiles: c.distanceMiles }) } }
}

export function validateComparableSet(records: readonly DealSaleComparable[], asOf: string): Validation {
  const issues = records.flatMap((c) => validateComparable(c, asOf).issues)
  const refs = new Map<string, DealSaleComparable>()
  for (const c of records) { const prior = refs.get(c.transactionReference); if (prior) issues.push(prior.salePrice === c.salePrice && prior.saleDate === c.saleDate && prior.propertyAddress === c.propertyAddress ? "duplicate transaction reference" : "conflicting transaction reference"); else refs.set(c.transactionReference, c) }
  const accepted = records.filter((c) => validateComparable(c, asOf).eligible)
  if (!accepted.length) issues.push("at least one accepted qualifying comparable is required")
  return { valid: issues.length === 0, eligible: issues.length === 0, issues }
}

export function validateGdvProposal(input: { gdvRealistic: number; rationale: string; comparableIds: readonly string[] }, basis: readonly DealSaleComparable[], asOf: string): Validation {
  const issues = validateComparableSet(basis.filter((c) => input.comparableIds.includes(c.id)), asOf).issues
  if (!Number.isFinite(input.gdvRealistic) || input.gdvRealistic <= 0) issues.push("GDV must be positive")
  if (!text(input.rationale)) issues.push("GDV rationale is required")
  if (!input.comparableIds.length) issues.push("comparable basis is required")
  return { valid: issues.length === 0, eligible: false, issues }
}

export function canTransitionValuation(from: GdvValuationState, to: GdvValuationState): boolean { return (from === "DRAFT" && (to === "APPROVED" || to === "REJECTED")) || (from === "APPROVED" && to === "SUPERSEDED") }
