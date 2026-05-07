# Phase 2 JSON Samples

These are compact examples derived from the existing Phase 2 contract and validation outputs. They are shortened for client review.

## Deal Heat Score

```json
{
  "score": 79,
  "band": "WARM",
  "positiveSignals": [
    "Healthy realistic profit margin.",
    "Comparable coverage is sufficient."
  ],
  "negativeSignals": [
    "Moderate GDV evidence."
  ],
  "deductions": [
    "+10: Healthy realistic profit margin.",
    "cap 79: Raw heat score capped because finance/time assumptions are not clean."
  ],
  "explanation": "Raw heat score uses transparent additive and subtractive rules only. Governance remains final authority."
}
```

## Risk Radar

```json
{
  "overallRisk": "HIGH",
  "riskFlags": [
    {
      "code": "GDV_EVIDENCE_WEAK",
      "label": "Weak GDV evidence",
      "severity": "HIGH",
      "source": "gdv"
    },
    {
      "code": "COMPARABLES_THIN",
      "label": "Thin comparable coverage",
      "severity": "MEDIUM",
      "source": "comparables"
    }
  ],
  "fatalRisks": [],
  "reviewRisks": [
    "Weak GDV evidence",
    "Thin comparable coverage"
  ]
}
```

## Strategy Match

```json
{
  "recommendedStrategy": "FLIP",
  "viableStrategies": [
    "FLIP"
  ],
  "rejectedStrategies": [
    {
      "strategy": "BRRR",
      "reason": "BRRR needs stronger refinance path, evidence, and manageable exposure."
    }
  ],
  "explanation": "FLIP is recommended because it is the clearest viable exit under the current evidence set."
}
```

## Governance Layer

```json
{
  "state": "BLOCKED",
  "finalClassification": "NO_DEAL",
  "scoreBeforeGovernance": 95,
  "classificationBeforeGovernance": "HOT",
  "governanceOverrideApplied": true,
  "fatalRisk": true,
  "fatalReasons": [
    "Structural survey indicates fatal risk."
  ],
  "reviewRequired": true,
  "explanation": "Governance overrides scoring because a fatal blocker exists."
}
```

## Investor Summary

```json
{
  "headline": "Raw HOT score blocked by governance.",
  "summary": "Raw opportunity signals exist, but final progression is blocked by governance controls and/or fatal risk.",
  "decision": "NO_DEAL",
  "recommendedNextStep": "Reject deal or clear fatal governance blocker before any offer step."
}
```

## Decision Gates

```json
[
  {
    "gateId": "capital-protection",
    "label": "Capital Protection Gate",
    "status": "FAIL",
    "severity": "FATAL"
  },
  {
    "gateId": "gdv-evidence",
    "label": "GDV Evidence Gate",
    "status": "REVIEW",
    "severity": "HIGH"
  }
]
```

## Evidence Status

```json
{
  "overallStatus": "MISSING",
  "missingCriticalEvidence": [
    "comparables"
  ],
  "assumedFields": [],
  "verifiedFields": [
    "refurbCost",
    "legal"
  ]
}
```

## Data Confidence

```json
{
  "overallConfidence": "LOW",
  "gdvConfidence": "LOW",
  "legalConfidence": "HIGH",
  "financeConfidence": "HIGH",
  "confidenceWarnings": [
    "GDV evidence is weak.",
    "Comparable support is thin."
  ]
}
```

## Next Actions

```json
[
  {
    "id": "obtain-comparables",
    "priority": "HIGH",
    "action": "Obtain sold comparables to support GDV.",
    "owner": "analyst",
    "blocksOfferSubmission": true
  },
  {
    "id": "tighten-finance-assumptions",
    "priority": "HIGH",
    "action": "Tighten finance assumptions and bridge timeline before offer.",
    "owner": "broker",
    "blocksOfferSubmission": true
  }
]
```
