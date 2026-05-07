import type {
  DataConfidenceOutput,
  DecisionGateOutput,
  EvidenceStatusOutput,
  FinalDealClassification,
  GovernanceOutput,
  RiskFlagOutput,
  RiskRadarOutput,
} from "@/types/phase2"

export const GOVERNANCE_EVIDENCE_STRENGTHS = ["STRONG", "MODERATE", "WEAK", "MISSING"] as const

export type GovernanceEvidenceStrength = typeof GOVERNANCE_EVIDENCE_STRENGTHS[number]

export type Phase2GovernanceInput = {
  scenarioId?: string
  purchasePrice: number
  gdvRealistic: number
  gdvDownside?: number
  gdvStrong?: number
  refurbCost: number
  financeCost?: number
  bridgeTermMonths?: number
  loanToValue?: number
  comparablesCount?: number
  gdvEvidenceStrength?: GovernanceEvidenceStrength
  refurbEvidenceStrength?: GovernanceEvidenceStrength
  legalEvidenceStrength?: GovernanceEvidenceStrength
  hasStructuralRisk?: boolean
  hasLegalTitleRisk?: boolean
  hasPlanningRisk?: boolean
  hasRefinanceRisk?: boolean
  hasMissingCriticalEvidence?: boolean
  manualReviewRequested?: boolean
  rawHeatScore?: number
  rawClassification?: FinalDealClassification
}

export type GovernanceDerivedMetrics = {
  financeCost: number | null
  totalInvestmentBasis: number | null
  realisticProfit: number | null
  downsideProfit: number | null
  strongProfit: number | null
  capitalRatio: number | null
  downsideThreshold: number | null
  refurbExposure: number | null
}

export type FatalRiskResult = {
  fatalRisk: boolean
  fatalReasons: string[]
  fatalFlags: RiskFlagOutput[]
  metrics: GovernanceDerivedMetrics
}

export type HumanReviewResult = {
  reviewRequired: boolean
  reviewReasons: string[]
}

export type ApplyGovernanceResult = {
  governance: GovernanceOutput
  decisionGates: DecisionGateOutput[]
  evidenceStatus: EvidenceStatusOutput
  dataConfidence: DataConfidenceOutput
  riskRadar: RiskRadarOutput
  reviewRequired: boolean
  reviewReasons: string[]
  fatalRisk: boolean
  fatalReasons: string[]
  metrics: GovernanceDerivedMetrics
}
