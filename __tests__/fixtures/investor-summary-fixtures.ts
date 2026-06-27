import type { InvestorSummaryViewModel } from "@/types/investor-summary"

export const INVESTOR_SUMMARY_BLOCKED_FIXTURE: InvestorSummaryViewModel = {
  deal: {
    dealId: "deal-summary-blocked-001",
    address: "12 Lake View Road, Leeds",
  },
  purchasePrice: 125000,
  gdvRange: {
    downside: 180000,
    realistic: 200000,
    strong: 220000,
  },
  trueMao: {
    fifteenPercent: 123800,
    twentyPercent: 113800,
    twentyFivePercent: 103800,
  },
  capitalProtectionState: "CAUTION",
  classification: "MARGINAL",
  investorShield: {
    overallStatus: "BLOCKED",
    missingEvidenceCount: 2,
    blockedGates: [
      {
        gateKey: "TITLE",
        label: "Title Review",
        gateType: "required",
        blockerReason: "Title review is missing required evidence.",
      },
      {
        gateKey: "REFURB_CERTAINTY",
        label: "Refurb Certainty",
        gateType: "required",
        blockerReason: "Refurb certainty remains blocked.",
      },
    ],
  },
  activeTasks: [
    {
      taskId: "task-summary-blocked-001",
      title: "Collect title pack",
      taskType: "DUE_DILIGENCE",
      status: "OPEN",
      priority: "HIGH",
      dueDate: "2026-06-12",
      blockerReason: "Waiting on legal documents.",
      createdAt: "2026-06-10T09:00:00.000Z",
      completedAt: null,
    },
    {
      taskId: "task-summary-blocked-002",
      title: "Request builder quote",
      taskType: "EVIDENCE",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: null,
      blockerReason: null,
      createdAt: "2026-06-10T10:15:00.000Z",
      completedAt: null,
    },
  ],
  latestOffer: {
    offerId: "offer-summary-blocked-001",
    amount: 118000,
    offerType: "INITIAL",
    offerStatus: "PENDING",
    rationale: "Initial offer with evidence caveat.",
    sellerResponse: null,
    createdAt: "2026-06-11T08:30:00.000Z",
  },
  recommendedNextAction: {
    source: "PERSISTED_NEXT_ACTION",
    actionText: "Review title and refurb evidence",
  },
}

export const INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE: InvestorSummaryViewModel = {
  deal: {
    dealId: "deal-summary-fallback-001",
    address: "8 Marina Crescent, Manchester",
  },
  purchasePrice: 98000,
  gdvRange: {
    downside: 150000,
    realistic: 165000,
    strong: 182000,
  },
  trueMao: {
    fifteenPercent: 104500,
    twentyPercent: 94500,
    twentyFivePercent: 84500,
  },
  capitalProtectionState: "SAFE",
  classification: "STRONG_DEAL",
  investorShield: {
    overallStatus: "CAUTION",
    missingEvidenceCount: 1,
    blockedGates: [
      {
        gateKey: "LENDER_CRITERIA",
        label: "Lender Criteria",
        gateType: "required",
        blockerReason: "Lender criteria evidence remains outstanding.",
      },
    ],
  },
  activeTasks: [],
  latestOffer: null,
  recommendedNextAction: {
    source: "INVESTOR_SHIELD_FALLBACK",
    actionText: "Request lender criteria evidence",
  },
}

export const INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE: InvestorSummaryViewModel = {
  deal: {
    dealId: "deal-summary-unavailable-001",
    address: "Address unavailable",
  },
  purchasePrice: null,
  gdvRange: {
    downside: null,
    realistic: null,
    strong: null,
  },
  trueMao: {
    fifteenPercent: null,
    twentyPercent: null,
    twentyFivePercent: null,
  },
  capitalProtectionState: null,
  classification: null,
  investorShield: {
    overallStatus: null,
    missingEvidenceCount: null,
    blockedGates: [],
  },
  activeTasks: [],
  latestOffer: null,
  recommendedNextAction: {
    source: "UNAVAILABLE",
    actionText: null,
  },
}

export const INVESTOR_SUMMARY_FIXTURES = [
  INVESTOR_SUMMARY_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE,
  INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
] as const
