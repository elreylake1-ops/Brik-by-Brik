import {
  CONFIDENCE_LEVELS,
  DECISION_GATE_STATUSES,
  DEAL_HEAT_BANDS,
  EVIDENCE_STATUSES,
  FINAL_DEAL_CLASSIFICATIONS,
  GOVERNANCE_STATES,
  NEXT_ACTION_PRIORITIES,
  PHASE2_ANALYSIS_SOURCE,
  PHASE2_STRATEGIES,
  RISK_SEVERITIES,
  type Phase2AnalysisOutput,
} from "@/types/phase2"

export type Phase2OutputValidationResult = {
  valid: boolean
  errors: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function pushMissingSection(errors: string[], output: Record<string, unknown>, key: keyof Phase2AnalysisOutput) {
  if (!(key in output)) {
    errors.push(`Missing top-level section: ${key}.`)
  }
}

function validateMetadata(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("metadata must be an object.")
    return
  }

  if (!isNonEmptyString(value.analysisId)) errors.push("metadata.analysisId must be a non-empty string.")
  if (!isNonEmptyString(value.engineVersion)) errors.push("metadata.engineVersion must be a non-empty string.")
  if (!isNonEmptyString(value.createdAt)) errors.push("metadata.createdAt must be a non-empty string.")
  if (!isBoolean(value.deterministic)) errors.push("metadata.deterministic must be a boolean.")
  if (!PHASE2_ANALYSIS_SOURCE.includes(value.source as never)) {
    errors.push(`metadata.source must be one of: ${PHASE2_ANALYSIS_SOURCE.join(", ")}.`)
  }
  if (value.scenarioId !== undefined && !isNonEmptyString(value.scenarioId)) {
    errors.push("metadata.scenarioId must be a non-empty string when provided.")
  }
  if (value.notes !== undefined && !isStringArray(value.notes)) {
    errors.push("metadata.notes must be a string array when provided.")
  }
}

function validateDealHeatScore(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("dealHeatScore must be an object.")
    return
  }

  if (!isFiniteNumber(value.score)) errors.push("dealHeatScore.score must be a finite number.")
  if (!DEAL_HEAT_BANDS.includes(value.band as never)) {
    errors.push(`dealHeatScore.band must be one of: ${DEAL_HEAT_BANDS.join(", ")}.`)
  }
  if (!isStringArray(value.positiveSignals)) errors.push("dealHeatScore.positiveSignals must be a string array.")
  if (!isStringArray(value.negativeSignals)) errors.push("dealHeatScore.negativeSignals must be a string array.")
  if (!isStringArray(value.deductions)) errors.push("dealHeatScore.deductions must be a string array.")
  if (!isNonEmptyString(value.explanation)) errors.push("dealHeatScore.explanation must be a non-empty string.")
}

function validateRiskRadar(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("riskRadar must be an object.")
    return
  }

  if (!RISK_SEVERITIES.includes(value.overallRisk as never)) {
    errors.push(`riskRadar.overallRisk must be one of: ${RISK_SEVERITIES.join(", ")}.`)
  }
  if (!Array.isArray(value.riskFlags)) {
    errors.push("riskRadar.riskFlags must be an array.")
  } else {
    value.riskFlags.forEach((flag, index) => {
      if (!isRecord(flag)) {
        errors.push(`riskRadar.riskFlags[${index}] must be an object.`)
        return
      }

      if (!isNonEmptyString(flag.code)) errors.push(`riskRadar.riskFlags[${index}].code must be a non-empty string.`)
      if (!isNonEmptyString(flag.label)) errors.push(`riskRadar.riskFlags[${index}].label must be a non-empty string.`)
      if (!RISK_SEVERITIES.includes(flag.severity as never)) {
        errors.push(`riskRadar.riskFlags[${index}].severity must be one of: ${RISK_SEVERITIES.join(", ")}.`)
      }
      if (!isNonEmptyString(flag.explanation)) {
        errors.push(`riskRadar.riskFlags[${index}].explanation must be a non-empty string.`)
      }
      if (!isNonEmptyString(flag.source)) errors.push(`riskRadar.riskFlags[${index}].source must be a non-empty string.`)
    })
  }

  if (!isStringArray(value.fatalRisks)) errors.push("riskRadar.fatalRisks must be a string array.")
  if (!isStringArray(value.reviewRisks)) errors.push("riskRadar.reviewRisks must be a string array.")
  if (!isNonEmptyString(value.explanation)) errors.push("riskRadar.explanation must be a non-empty string.")
}

function validateStrategyMatch(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("strategyMatch must be an object.")
    return
  }

  if (!PHASE2_STRATEGIES.includes(value.recommendedStrategy as never)) {
    errors.push(`strategyMatch.recommendedStrategy must be one of: ${PHASE2_STRATEGIES.join(", ")}.`)
  }
  if (
    !Array.isArray(value.viableStrategies) ||
    !value.viableStrategies.every((strategy) => PHASE2_STRATEGIES.includes(strategy as never))
  ) {
    errors.push(`strategyMatch.viableStrategies must contain only: ${PHASE2_STRATEGIES.join(", ")}.`)
  }
  if (!Array.isArray(value.rejectedStrategies)) {
    errors.push("strategyMatch.rejectedStrategies must be an array.")
  } else {
    value.rejectedStrategies.forEach((entry, index) => {
      if (!isRecord(entry)) {
        errors.push(`strategyMatch.rejectedStrategies[${index}] must be an object.`)
        return
      }

      if (!PHASE2_STRATEGIES.includes(entry.strategy as never)) {
        errors.push(`strategyMatch.rejectedStrategies[${index}].strategy must be one of: ${PHASE2_STRATEGIES.join(", ")}.`)
      }
      if (!isNonEmptyString(entry.reason)) {
        errors.push(`strategyMatch.rejectedStrategies[${index}].reason must be a non-empty string.`)
      }
    })
  }
  if (!isNonEmptyString(value.explanation)) errors.push("strategyMatch.explanation must be a non-empty string.")
}

function validateGovernance(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("governance must be an object.")
    return
  }

  if (!GOVERNANCE_STATES.includes(value.state as never)) {
    errors.push(`governance.state must be one of: ${GOVERNANCE_STATES.join(", ")}.`)
  }
  if (!FINAL_DEAL_CLASSIFICATIONS.includes(value.finalClassification as never)) {
    errors.push(
      `governance.finalClassification must be one of: ${FINAL_DEAL_CLASSIFICATIONS.join(", ")}.`
    )
  }
  if (value.scoreBeforeGovernance !== null && !isFiniteNumber(value.scoreBeforeGovernance)) {
    errors.push("governance.scoreBeforeGovernance must be a finite number or null.")
  }
  if (
    value.classificationBeforeGovernance !== null &&
    !FINAL_DEAL_CLASSIFICATIONS.includes(value.classificationBeforeGovernance as never)
  ) {
    errors.push(
      `governance.classificationBeforeGovernance must be one of: ${FINAL_DEAL_CLASSIFICATIONS.join(", ")} or null.`
    )
  }
  if (!isBoolean(value.governanceOverrideApplied)) {
    errors.push("governance.governanceOverrideApplied must be a boolean.")
  }
  if (!isBoolean(value.fatalRisk)) errors.push("governance.fatalRisk must be a boolean.")
  if (!isStringArray(value.fatalReasons)) errors.push("governance.fatalReasons must be a string array.")
  if (!isStringArray(value.blockedBy)) errors.push("governance.blockedBy must be a string array.")
  if (!isBoolean(value.reviewRequired)) errors.push("governance.reviewRequired must be a boolean.")
  if (!isStringArray(value.reviewReasons)) errors.push("governance.reviewReasons must be a string array.")
  if (!isNonEmptyString(value.explanation)) errors.push("governance.explanation must be a non-empty string.")
}

function validateInvestorSummary(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("investorSummary must be an object.")
    return
  }

  if (!isNonEmptyString(value.headline)) errors.push("investorSummary.headline must be a non-empty string.")
  if (!isNonEmptyString(value.summary)) errors.push("investorSummary.summary must be a non-empty string.")
  if (!isNonEmptyString(value.decision)) errors.push("investorSummary.decision must be a non-empty string.")
  if (!isStringArray(value.keyReasons)) errors.push("investorSummary.keyReasons must be a string array.")
  if (!isStringArray(value.keyRisks)) errors.push("investorSummary.keyRisks must be a string array.")
  if (!isNonEmptyString(value.recommendedNextStep)) {
    errors.push("investorSummary.recommendedNextStep must be a non-empty string.")
  }
  if (!isStringArray(value.investorWarnings)) {
    errors.push("investorSummary.investorWarnings must be a string array.")
  }
}

function validateDecisionGates(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("decisionGates must be an array.")
    return
  }

  value.forEach((gate, index) => {
    if (!isRecord(gate)) {
      errors.push(`decisionGates[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(gate.gateId)) errors.push(`decisionGates[${index}].gateId must be a non-empty string.`)
    if (!isNonEmptyString(gate.label)) errors.push(`decisionGates[${index}].label must be a non-empty string.`)
    if (!DECISION_GATE_STATUSES.includes(gate.status as never)) {
      errors.push(`decisionGates[${index}].status must be one of: ${DECISION_GATE_STATUSES.join(", ")}.`)
    }
    if (!RISK_SEVERITIES.includes(gate.severity as never)) {
      errors.push(`decisionGates[${index}].severity must be one of: ${RISK_SEVERITIES.join(", ")}.`)
    }
    if (!isNonEmptyString(gate.explanation)) {
      errors.push(`decisionGates[${index}].explanation must be a non-empty string.`)
    }
    if (!isStringArray(gate.triggeredBy)) {
      errors.push(`decisionGates[${index}].triggeredBy must be a string array.`)
    }
    if (gate.requiredAction !== undefined && !isNonEmptyString(gate.requiredAction)) {
      errors.push(`decisionGates[${index}].requiredAction must be a non-empty string when provided.`)
    }
  })
}

function validateEvidenceStatus(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("evidenceStatus must be an object.")
    return
  }

  if (!EVIDENCE_STATUSES.includes(value.overallStatus as never)) {
    errors.push(`evidenceStatus.overallStatus must be one of: ${EVIDENCE_STATUSES.join(", ")}.`)
  }
  if (!Array.isArray(value.fields)) {
    errors.push("evidenceStatus.fields must be an array.")
  } else {
    value.fields.forEach((field, index) => {
      if (!isRecord(field)) {
        errors.push(`evidenceStatus.fields[${index}] must be an object.`)
        return
      }

      if (!isNonEmptyString(field.field)) errors.push(`evidenceStatus.fields[${index}].field must be a non-empty string.`)
      if (!EVIDENCE_STATUSES.includes(field.status as never)) {
        errors.push(`evidenceStatus.fields[${index}].status must be one of: ${EVIDENCE_STATUSES.join(", ")}.`)
      }
      if (!isNonEmptyString(field.explanation)) {
        errors.push(`evidenceStatus.fields[${index}].explanation must be a non-empty string.`)
      }
      if (!isBoolean(field.requiredForOffer)) {
        errors.push(`evidenceStatus.fields[${index}].requiredForOffer must be a boolean.`)
      }
    })
  }

  if (!isStringArray(value.missingCriticalEvidence)) {
    errors.push("evidenceStatus.missingCriticalEvidence must be a string array.")
  }
  if (!isStringArray(value.assumedFields)) errors.push("evidenceStatus.assumedFields must be a string array.")
  if (!isStringArray(value.verifiedFields)) errors.push("evidenceStatus.verifiedFields must be a string array.")
}

function validateDataConfidence(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("dataConfidence must be an object.")
    return
  }

  const confidenceFields = [
    "overallConfidence",
    "listingConfidence",
    "refurbConfidence",
    "gdvConfidence",
    "legalConfidence",
    "financeConfidence",
  ] as const

  confidenceFields.forEach((field) => {
    if (!CONFIDENCE_LEVELS.includes(value[field] as never)) {
      errors.push(`dataConfidence.${field} must be one of: ${CONFIDENCE_LEVELS.join(", ")}.`)
    }
  })

  if (!isNonEmptyString(value.explanation)) errors.push("dataConfidence.explanation must be a non-empty string.")
  if (!isStringArray(value.confidenceWarnings)) {
    errors.push("dataConfidence.confidenceWarnings must be a string array.")
  }
}

function validateNextActions(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("nextActions must be an array.")
    return
  }

  value.forEach((action, index) => {
    if (!isRecord(action)) {
      errors.push(`nextActions[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(action.id)) errors.push(`nextActions[${index}].id must be a non-empty string.`)
    if (!NEXT_ACTION_PRIORITIES.includes(action.priority as never)) {
      errors.push(`nextActions[${index}].priority must be one of: ${NEXT_ACTION_PRIORITIES.join(", ")}.`)
    }
    if (!isNonEmptyString(action.action)) errors.push(`nextActions[${index}].action must be a non-empty string.`)
    if (!isNonEmptyString(action.owner)) errors.push(`nextActions[${index}].owner must be a non-empty string.`)
    if (!isNonEmptyString(action.reason)) errors.push(`nextActions[${index}].reason must be a non-empty string.`)
    if (!isBoolean(action.blocksOfferSubmission)) {
      errors.push(`nextActions[${index}].blocksOfferSubmission must be a boolean.`)
    }
  })
}

function validateAssumptions(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("assumptions must be an array.")
    return
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`assumptions[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(entry.id)) errors.push(`assumptions[${index}].id must be a non-empty string.`)
    if (!isNonEmptyString(entry.field)) errors.push(`assumptions[${index}].field must be a non-empty string.`)
    if (!("assumedValue" in entry)) errors.push(`assumptions[${index}].assumedValue is required.`)
    if (!isNonEmptyString(entry.reason)) errors.push(`assumptions[${index}].reason must be a non-empty string.`)
    if (!isNonEmptyString(entry.impact)) errors.push(`assumptions[${index}].impact must be a non-empty string.`)
    if (!CONFIDENCE_LEVELS.includes(entry.confidence as never)) {
      errors.push(`assumptions[${index}].confidence must be one of: ${CONFIDENCE_LEVELS.join(", ")}.`)
    }
  })
}

function validateOverrides(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("overrides must be an array.")
    return
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`overrides[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(entry.id)) errors.push(`overrides[${index}].id must be a non-empty string.`)
    if (!isNonEmptyString(entry.field)) errors.push(`overrides[${index}].field must be a non-empty string.`)
    if (!("originalValue" in entry)) errors.push(`overrides[${index}].originalValue is required.`)
    if (!("overrideValue" in entry)) errors.push(`overrides[${index}].overrideValue is required.`)
    if (entry.reason !== undefined && !isNonEmptyString(entry.reason)) {
      errors.push(`overrides[${index}].reason must be a non-empty string when provided.`)
    }
    if (!isNonEmptyString(entry.impact)) errors.push(`overrides[${index}].impact must be a non-empty string.`)
    if (entry.createdAt !== undefined && !isNonEmptyString(entry.createdAt)) {
      errors.push(`overrides[${index}].createdAt must be a non-empty string when provided.`)
    }
  })
}

function validateLimitations(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("limitations must be an array.")
    return
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`limitations[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(entry.code)) errors.push(`limitations[${index}].code must be a non-empty string.`)
    if (!isNonEmptyString(entry.limitation)) {
      errors.push(`limitations[${index}].limitation must be a non-empty string.`)
    }
    if (!isNonEmptyString(entry.impact)) errors.push(`limitations[${index}].impact must be a non-empty string.`)
    if (!isNonEmptyString(entry.recommendedRefinement)) {
      errors.push(`limitations[${index}].recommendedRefinement must be a non-empty string.`)
    }
  })
}

export function validatePhase2Output(output: unknown): Phase2OutputValidationResult {
  if (!isRecord(output)) {
    return { valid: false, errors: ["Phase 2 output must be an object."] }
  }

  const errors: string[] = []
  const topLevelKeys: (keyof Phase2AnalysisOutput)[] = [
    "metadata",
    "dealHeatScore",
    "riskRadar",
    "strategyMatch",
    "governance",
    "investorSummary",
    "decisionGates",
    "evidenceStatus",
    "dataConfidence",
    "nextActions",
    "assumptions",
    "overrides",
    "limitations",
  ]

  topLevelKeys.forEach((key) => pushMissingSection(errors, output, key))

  validateMetadata(output.metadata, errors)
  validateDealHeatScore(output.dealHeatScore, errors)
  validateRiskRadar(output.riskRadar, errors)
  validateStrategyMatch(output.strategyMatch, errors)
  validateGovernance(output.governance, errors)
  validateInvestorSummary(output.investorSummary, errors)
  validateDecisionGates(output.decisionGates, errors)
  validateEvidenceStatus(output.evidenceStatus, errors)
  validateDataConfidence(output.dataConfidence, errors)
  validateNextActions(output.nextActions, errors)
  validateAssumptions(output.assumptions, errors)
  validateOverrides(output.overrides, errors)
  validateLimitations(output.limitations, errors)

  return {
    valid: errors.length === 0,
    errors,
  }
}
