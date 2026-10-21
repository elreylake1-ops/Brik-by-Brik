import { loadPdfEvidencePackForDeal } from "@/lib/pdf-evidence-pack/load-pdf-evidence-pack"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { pgViewingAssessmentRepository } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { pgFinancialProposalRepository } from "./pg-financial-proposal-repository"
import { pgMeasurementRepository } from "./pg-measurement-repository"
import { pgRefurbPlanRepository } from "./pg-plan-repository"
import type { DocumentDeps } from "./documents-service"

// The one place production dependencies are wired. Note what is NOT here: no function that updates a Saved Deal,
// Investor Shield record, governance state or pipeline state.

const productionDeps: DocumentDeps = {
  viewing: pgViewingAssessmentRepository,
  plans: pgRefurbPlanRepository,
  measurements: pgMeasurementRepository,
  proposals: pgFinancialProposalRepository,
  getDeal: getSavedDealById,
  now: () => new Date(),
  loadPack: (dealId, generatedAt) =>
    loadPdfEvidencePackForDeal({ dealId, generatedAt, confidentialityLabel: "INTERNAL USE ONLY - DRAFT" }),
}

let testDeps: DocumentDeps | undefined

/** Test seam. Refuses to run outside NODE_ENV=test; there is no environment variable that reaches it. */
export function __setRefurbDepsForTests(deps: DocumentDeps | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("__setRefurbDepsForTests is test-only")
  testDeps = deps
}

export const getRefurbDeps = (): DocumentDeps => testDeps ?? productionDeps
