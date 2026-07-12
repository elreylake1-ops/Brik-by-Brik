import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  FINAL_DECISION_LOCK_STATUSES,
  PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS,
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES,
  PROFESSIONAL_GATE_AREAS,
  PROFESSIONAL_GATE_STATUSES,
  PROFESSIONAL_READINESS_STATUSES,
} from "@/types/professional-evidence-gateway"
import type {
  ProfessionalEvidenceGatewayGate,
} from "@/types/professional-evidence-gateway"

describe("professional evidence gateway contract", () => {
  it("exports the approved professional gate areas", () => {
    expect(PROFESSIONAL_GATE_AREAS).toEqual([
      "SOLICITOR_REVIEW",
      "LEASEHOLD_ADVICE",
      "BROKER_LENDER_CONFIRMATION",
      "BUILDER_QUOTE_CONFIRMATION",
      "SURVEYOR_REPORT",
      "SOLD_COMPARABLE_REVIEW",
    ])
    expect(new Set(PROFESSIONAL_GATE_AREAS).size).toBe(PROFESSIONAL_GATE_AREAS.length)
  })

  it("exports the approved gate, readiness, lock, and review source values", () => {
    expect(PROFESSIONAL_GATE_STATUSES).toEqual([
      "NOT_STARTED",
      "REQUESTED",
      "RECEIVED",
      "UNDER_REVIEW",
      "CONFIRMED",
      "ADVERSE",
      "EXPIRED",
      "NOT_REQUIRED",
    ])

    expect(PROFESSIONAL_READINESS_STATUSES).toEqual([
      "NOT_READY",
      "PARTIALLY_READY",
      "READY_FOR_REVIEW",
      "PROFESSIONALLY_CONFIRMED",
      "BLOCKED",
    ])

    expect(FINAL_DECISION_LOCK_STATUSES).toEqual([
      "LOCKED",
      "UNLOCKED_FOR_REVIEW",
      "BLOCKED_BY_HARD_GATE",
      "BLOCKED_BY_PROFESSIONAL_EVIDENCE",
      "MANUAL_REVIEW_REQUIRED",
    ])

    expect(PROFESSIONAL_EVIDENCE_REVIEW_SOURCES).toEqual([
      "OPERATOR_NOTE",
      "SOLICITOR",
      "BROKER",
      "LENDER",
      "BUILDER",
      "SURVEYOR",
      "LAND_REGISTRY",
      "RIGHTMOVE_SOLD_DATA",
      "AGENT",
      "OTHER",
    ])
  })

  it("keeps the defaults conservative", () => {
    expect(PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS).toEqual({
      professionalGateStatus: "NOT_STARTED",
      professionalReadiness: "NOT_READY",
      finalDecisionLockStatus: "LOCKED",
    })

    expect(Object.values(PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS)).not.toContain("CONFIRMED")
    expect(Object.values(PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS)).not.toContain(
      "PROFESSIONALLY_CONFIRMED"
    )
    expect(Object.values(PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS)).not.toContain(
      "UNLOCKED_FOR_REVIEW"
    )
  })

  it("carries reviewSource on the record and gate contracts", () => {
    const typeSource = readFileSync(
      path.resolve(process.cwd(), "types/professional-evidence-gateway.ts"),
      "utf8"
    )

    expect(typeSource).toMatch(
      /export type ProfessionalEvidenceGatewayRecord = \{[\s\S]*?readonly reviewSource: ProfessionalEvidenceReviewSource/
    )
    expect(typeSource).toMatch(
      /export type ProfessionalEvidenceGatewayGate = \{[\s\S]*?readonly reviewSource: ProfessionalEvidenceReviewSource/
    )
  })

  it("lets each gate preserve its own review source independently", () => {
    const solicitorGate = { reviewSource: "SOLICITOR" } as const satisfies Pick<
      ProfessionalEvidenceGatewayGate,
      "reviewSource"
    >
    const brokerGate = { reviewSource: "BROKER" } as const satisfies Pick<
      ProfessionalEvidenceGatewayGate,
      "reviewSource"
    >

    expect([solicitorGate.reviewSource, brokerGate.reviewSource]).toEqual([
      "SOLICITOR",
      "BROKER",
    ])
  })

  it("keeps solicitor review canonical and excludes solicitor feedback from the professional area namespace", () => {
    expect(PROFESSIONAL_GATE_AREAS).toContain("SOLICITOR_REVIEW")
    expect(PROFESSIONAL_GATE_AREAS).not.toContain("SOLICITOR_FEEDBACK")
    expect(PROFESSIONAL_GATE_AREAS.filter((area) => area.startsWith("SOLICITOR_"))).toEqual([
      "SOLICITOR_REVIEW",
    ])
  })

  it("does not import runtime modules", () => {
    const typeSource = readFileSync(
      path.resolve(process.cwd(), "types/professional-evidence-gateway.ts"),
      "utf8"
    )

    expect(typeSource).not.toMatch(/^\s*import\s/m)
    expect(typeSource).not.toContain("@/app/")
    expect(typeSource).not.toContain("@/components/")
    expect(typeSource).not.toContain("@/lib/")
    expect(typeSource).not.toContain("@/db/")
    expect(typeSource).not.toContain("/api/")
  })
})
