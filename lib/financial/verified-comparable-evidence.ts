import type { ProfessionalEvidenceReviewSource } from "@/types/professional-evidence-gateway"

export type ComparableVerificationStatus = "CONFIRMED" | "UNVERIFIED" | "REJECTED"
export type ComparableTransactionStatus = "COMPLETED" | "ASKING" | "UNDER_OFFER" | "EXCHANGED_NOT_COMPLETED" | "UNKNOWN" | "WITHDRAWN"
export type VerifiedComparableEvidence = {
  evidenceId: string
  property: { address: string; postcode?: string }
  soldPrice: number
  transactionDate: string
  transaction: { status: ComparableTransactionStatus; reference?: string }
  source: ProfessionalEvidenceReviewSource
  sourceReference: string
  verification: { status: ComparableVerificationStatus; reviewerId: string | null; reviewedAt: string | null; reviewDueAt?: string }
  similarity: { bedrooms?: number; distanceMiles?: number; notes?: string }
  supportingDocumentReference?: string
}
export type ComparableEvidenceClassification = {
  status: "MISSING" | "VERIFIED" | "NON_CONFIRMING" | "MIXED" | "REVIEW_REQUIRED"
  confidence: "MISSING" | "NON_CONFIRMING" | "REVIEW_REQUIRED" | "VERIFIED"
  verifiedCount: number
  nonConfirmingCount: number
  issues: string[]
  evidenceIds: string[]
  conflicts: string[]
}
const CONFIRMING_SOURCES = new Set<ProfessionalEvidenceReviewSource>(["LAND_REGISTRY", "SURVEYOR", "SOLICITOR"])
const isDate = (value: string | null | undefined): boolean => Boolean(value && !Number.isNaN(Date.parse(value)))
function validStructure(item: VerifiedComparableEvidence): boolean {
  return Boolean(item.evidenceId.trim() && item.property.address.trim() && item.soldPrice > 0 && isDate(item.transactionDate) && item.sourceReference.trim() && isDate(item.verification.reviewedAt) && item.verification.reviewerId?.trim() && (item.similarity.bedrooms === undefined || item.similarity.bedrooms >= 0) && (item.similarity.distanceMiles === undefined || item.similarity.distanceMiles >= 0))
}
export function classifyVerifiedComparableEvidence(evidence: readonly VerifiedComparableEvidence[], asOf: string): ComparableEvidenceClassification {
  const issues: string[] = []
  const evidenceIds = evidence.map((item) => item.evidenceId)
  if (!isDate(asOf)) return { status: "REVIEW_REQUIRED", confidence: "REVIEW_REQUIRED", verifiedCount: 0, nonConfirmingCount: 0, issues: ["classification date is invalid"], evidenceIds, conflicts: [] }
  if (evidence.length === 0) return { status: "MISSING", confidence: "MISSING", verifiedCount: 0, nonConfirmingCount: 0, issues: ["no comparable evidence supplied"], evidenceIds, conflicts: [] }
  let verifiedCount = 0
  let nonConfirmingCount = 0
  const conflicts: string[] = []
  const byReference = new Map<string, VerifiedComparableEvidence[]>()
  for (const item of evidence) if (item.transaction.reference?.trim()) byReference.set(item.transaction.reference, [...(byReference.get(item.transaction.reference) ?? []), item])
  for (const [reference, records] of byReference) {
    const first = records[0]
    for (const item of records.slice(1)) {
      if (item.transaction.status !== first.transaction.status) conflicts.push(`${reference}: completion status conflicts`)
      if (item.soldPrice !== first.soldPrice) conflicts.push(`${reference}: sold price conflicts`)
      if (item.transactionDate !== first.transactionDate) conflicts.push(`${reference}: transaction date conflicts`)
      if (item.property.address.trim().toLowerCase() !== first.property.address.trim().toLowerCase()) conflicts.push(`${reference}: property identity conflicts`)
    }
  }
  issues.push(...conflicts)
  for (const item of evidence) {
    if (!validStructure(item)) { issues.push(`${item.evidenceId || "comparable"} is incomplete or lacks provenance and human verification`); continue }
    if (item.verification.reviewDueAt && isDate(item.verification.reviewDueAt) && Date.parse(item.verification.reviewDueAt) < Date.parse(asOf)) { issues.push(`${item.evidenceId} verification review is stale`); continue }
    if (item.transaction.status !== "COMPLETED") { issues.push(`${item.evidenceId} transaction is not a completed sale`); continue }
    if (item.verification.status !== "CONFIRMED") { issues.push(`${item.evidenceId} is not human-confirmed`); continue }
    if (!CONFIRMING_SOURCES.has(item.source)) { nonConfirmingCount++; continue }
    verifiedCount++
  }
  const status = issues.length > 0 ? "REVIEW_REQUIRED" : verifiedCount > 0 && nonConfirmingCount > 0 ? "MIXED" : verifiedCount > 0 ? "VERIFIED" : "NON_CONFIRMING"
  return { status, confidence: status === "VERIFIED" ? "VERIFIED" : status === "NON_CONFIRMING" ? "NON_CONFIRMING" : "REVIEW_REQUIRED", verifiedCount, nonConfirmingCount, issues, evidenceIds, conflicts }
}
