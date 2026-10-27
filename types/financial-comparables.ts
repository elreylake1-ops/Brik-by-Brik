import type { ProfessionalEvidenceReviewSource } from "@/types/professional-evidence-gateway"

export const COMPARABLE_REVIEW_STATES = ["PENDING", "ACCEPTED", "REJECTED"] as const
export type ComparableReviewState = typeof COMPARABLE_REVIEW_STATES[number]
export type DealSaleComparable = { id: string; dealId: string; evidenceId: string; propertyAddress: string; postcode?: string; salePrice: number; saleDate: string; transactionReference: string; sourceType: ProfessionalEvidenceReviewSource; sourceReference: string; propertyType?: string; bedrooms?: number; distanceMiles?: number; reviewState: ComparableReviewState; reviewedBy?: string; reviewedAt?: string; reviewDueAt?: string; rejectionReason?: string; createdAt: string; updatedAt: string }

export const GDV_VALUATION_STATES = ["DRAFT", "APPROVED", "REJECTED", "SUPERSEDED"] as const
export type GdvValuationState = typeof GDV_VALUATION_STATES[number]
export type GdvValuation = { id: string; dealId: string; gdvRealistic: number; status: GdvValuationState; rationale: string; proposedBy: string; proposedAt: string; approvedBy?: string; approvedAt?: string; rejectedBy?: string; rejectedAt?: string; rejectionReason?: string; supersedesValuationId?: string; appliedBy?: string; appliedAt?: string; createdAt: string }
export type GdvValuationComparable = { valuationId: string; comparableId: string }
export interface ComparableRepository { listByDeal(dealId: string): Promise<readonly DealSaleComparable[]>; getById(id: string): Promise<DealSaleComparable | null>; listAcceptedByDeal(dealId: string): Promise<readonly DealSaleComparable[]> }
export interface GdvValuationService { createDraft(): Promise<void>; approve(): Promise<void>; reject(): Promise<void>; supersede(): Promise<void>; applyApproved(): Promise<void> }
