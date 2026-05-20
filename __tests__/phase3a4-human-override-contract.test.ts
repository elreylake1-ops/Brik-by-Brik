import { describe, expect, it } from "vitest"
import type {
  Phase3A4HumanOverrideGovernance,
  Phase3A4HumanOverrideValidation,
} from "@/types/phase3-enforcement"
import * as enforcementContracts from "@/types/phase3-enforcement"

describe("Phase 3A-4 human override governance contracts", () => {
  it("override scopes include all required values", () => {
    expect(enforcementContracts.PHASE3A4_OVERRIDE_SCOPES).toEqual(
      expect.arrayContaining([
        "review_only",
        "proceed_with_caution",
        "manual_exception",
        "blocked_override_request",
      ])
    )
  })

  it("human override object shape is valid", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-01",
      overrideReason: "Manual legal nuance requires review-only handling.",
      overrideTimestamp: "2026-05-20T12:00:00Z",
      originalClassification: "NO_DEAL",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "review_only",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.overrideBy.length).toBeGreaterThan(0)
  })

  it("originalDeterministicResultPreserved must be true in valid contract examples", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-02",
      overrideReason: "Risk escalated for manual exception handling.",
      overrideTimestamp: "2026-05-20T13:00:00Z",
      originalClassification: "REVIEW_REQUIRED",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "manual_exception",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.originalDeterministicResultPreserved).toBe(true)
  })

  it("advisoryOnly is true", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-03",
      overrideReason: "Proceed with caution under explicit review trail.",
      overrideTimestamp: "2026-05-20T14:00:00Z",
      originalClassification: "MARGINAL",
      overrideClassification: "CONDITIONAL",
      riskAcknowledged: true,
      overrideScope: "proceed_with_caution",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.advisoryOnly).toBe(true)
  })

  it("overrideReason exists in valid example", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-04",
      overrideReason: "Evidence conflict requires manual exception review path.",
      overrideTimestamp: "2026-05-20T15:00:00Z",
      originalClassification: "NO_DEAL",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "manual_exception",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.overrideReason.length).toBeGreaterThan(0)
  })

  it("riskAcknowledged can be true in valid example", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-05",
      overrideReason: "Risk acknowledged and retained for review tracking.",
      overrideTimestamp: "2026-05-20T16:00:00Z",
      originalClassification: "REVIEW_REQUIRED",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "review_only",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.riskAcknowledged).toBe(true)
  })

  it("reviewRequiredAfterOverride can be true in valid example", () => {
    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-06",
      overrideReason: "Manual review must continue after override note.",
      overrideTimestamp: "2026-05-20T17:00:00Z",
      originalClassification: "REVIEW_REQUIRED",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "review_only",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }
    expect(override.reviewRequiredAfterOverride).toBe(true)
  })

  it("validation statuses include missing_reason", () => {
    expect(enforcementContracts.PHASE3A4_HUMAN_OVERRIDE_VALIDATION_STATUSES).toContain("missing_reason")
  })

  it("validation statuses include original_result_not_preserved", () => {
    expect(enforcementContracts.PHASE3A4_HUMAN_OVERRIDE_VALIDATION_STATUSES).toContain(
      "original_result_not_preserved"
    )
  })

  it("validation status contract shape is valid", () => {
    const validation: Phase3A4HumanOverrideValidation = {
      status: "valid_override_contract",
      errors: [],
      warnings: [],
      advisoryOnly: true,
    }
    expect(validation.advisoryOnly).toBe(true)
  })

  it("no runtime fields exist on override and validation contracts", () => {
    const forbiddenFields = [
      "execute",
      "enforce",
      "apply",
      "mutate",
      "persist",
      "fetch",
      "api",
      "aiModel",
      "database",
      "routeHandler",
      "handler",
      "save",
      "approve",
      "submit",
    ]

    const override: Phase3A4HumanOverrideGovernance = {
      overrideBy: "reviewer-07",
      overrideReason: "Review-only override note.",
      overrideTimestamp: "2026-05-20T18:00:00Z",
      originalClassification: "NO_DEAL",
      overrideClassification: "REVIEW_REQUIRED",
      riskAcknowledged: true,
      overrideScope: "review_only",
      reviewRequiredAfterOverride: true,
      originalDeterministicResultPreserved: true,
      advisoryOnly: true,
    }

    const validation: Phase3A4HumanOverrideValidation = {
      status: "missing_reason",
      errors: ["overrideReason is required"],
      warnings: [],
      advisoryOnly: true,
    }

    for (const key of Object.keys(override)) {
      expect(forbiddenFields).not.toContain(key)
    }

    for (const key of Object.keys(validation)) {
      expect(forbiddenFields).not.toContain(key)
    }
  })

  it("no validation/runtime override function is exported", () => {
    expect("validatePhase3A4HumanOverride" in enforcementContracts).toBe(false)
    expect("applyPhase3A4HumanOverride" in enforcementContracts).toBe(false)
    expect("approvePhase3A4HumanOverride" in enforcementContracts).toBe(false)
    expect("submitPhase3A4HumanOverride" in enforcementContracts).toBe(false)
  })
})
