import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldGateSummaryPanel from "@/components/InvestorShieldGateSummaryPanel"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildInvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import type { EvidenceItem, InvestorShieldCheck } from "@/types/investor-shield"

const DEAL_ID = "deal-adapter-panel-preview"
const FIXED_TIMESTAMP = "2026-06-06T12:00:00.000Z"

function buildChecks(): readonly InvestorShieldCheck[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.map((gate) => {
    if (gate.key === "TITLE") {
      return {
        dealId: DEAL_ID,
        gateKey: gate.key,
        status: "FAILED",
        severity: "BLOCKER",
        confidence: "HIGH",
        requiredEvidence: gate.evidenceTypes,
        summary: "Title review needs follow-up.",
        updatedAt: FIXED_TIMESTAMP,
      }
    }

    if (gate.key === "PLANNING_BUILDING_CONTROL") {
      return {
        dealId: DEAL_ID,
        gateKey: gate.key,
        status: "REQUIRED",
        severity: "CAUTION",
        confidence: "MEDIUM",
        requiredEvidence: gate.evidenceTypes,
        summary: "Planning and building control evidence is still pending.",
        updatedAt: FIXED_TIMESTAMP,
      }
    }

    if (gate.key === "RENTAL_DEMAND") {
      return {
        dealId: DEAL_ID,
        gateKey: gate.key,
        status: "SATISFIED",
        severity: "CAUTION",
        confidence: "LOW",
        requiredEvidence: gate.evidenceTypes,
        summary: "Rental demand evidence is advisory-only for this preview.",
        updatedAt: FIXED_TIMESTAMP,
      }
    }

    if (gate.key === "REFURB_CERTAINTY") {
      return {
        dealId: DEAL_ID,
        gateKey: gate.key,
        status: "SATISFIED",
        severity: "BLOCKER",
        confidence: "MEDIUM",
        requiredEvidence: gate.evidenceTypes,
        summary: "Refurb certainty has enough hard evidence for preview rendering.",
        updatedAt: FIXED_TIMESTAMP,
      }
    }

    if (gate.key === "SOLICITOR_FEEDBACK") {
      return {
        dealId: DEAL_ID,
        gateKey: gate.key,
        status: "WAIVED",
        severity: "BLOCKER",
        confidence: "HIGH",
        requiredEvidence: gate.evidenceTypes,
        summary: "Solicitor feedback was waived for this preview.",
        updatedAt: FIXED_TIMESTAMP,
      }
    }

    return {
      dealId: DEAL_ID,
      gateKey: gate.key,
      status: "SATISFIED",
      severity: gate.defaultSeverity,
      confidence: "HIGH",
      requiredEvidence: gate.evidenceTypes,
      summary: `${gate.label} is satisfied for preview rendering.`,
      updatedAt: FIXED_TIMESTAMP,
    }
  })
}

function buildEvidenceItems(): readonly EvidenceItem[] {
  return [
    {
      dealId: DEAL_ID,
      gateKey: "SOLD_COMPS",
      evidenceType: "SOLD_COMPARABLE",
      source: "document",
      confidence: "HIGH",
      label: "Comparable pack",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "TITLE",
      evidenceType: "TITLE_DOCUMENT",
      source: "document",
      confidence: "HIGH",
      label: "Title register",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "MEDIA_EVIDENCE_PACK",
      evidenceType: "REFURB_PHOTO",
      source: "media",
      confidence: "MEDIUM",
      label: "Front room photo",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "MEDIA_EVIDENCE_PACK",
      evidenceType: "REFURB_VIDEO",
      source: "media",
      confidence: "MEDIUM",
      label: "Walkthrough video",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "ROOM_MEASUREMENT_SCHEDULE",
      evidenceType: "ROOM_MEASUREMENT",
      source: "document",
      confidence: "HIGH",
      label: "Room measurement schedule",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "BUILDER_QUOTE_EVIDENCE",
      evidenceType: "BUILDER_QUOTE",
      source: "professional",
      confidence: "HIGH",
      label: "Builder quote",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "AI_VISUAL_REVIEW_ADVISORY",
      evidenceType: "REFURB_PHOTO",
      source: "ai_advisory",
      confidence: "LOW",
      label: "AI visual note",
      advisoryOnly: true,
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "SOLICITOR_FEEDBACK",
      evidenceType: "SOLICITOR_FEEDBACK",
      source: "document",
      confidence: "HIGH",
      label: "Solicitor review note",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      dealId: DEAL_ID,
      gateKey: "RENTAL_DEMAND",
      evidenceType: "RENTAL_EVIDENCE",
      source: "ai_advisory",
      confidence: "LOW",
      label: "Advisory rental note",
      advisoryOnly: true,
      createdAt: FIXED_TIMESTAMP,
    },
  ]
}

describe("investor shield adapter panel preview", () => {
  it("renders the panel from the adapter output without touching live app wiring", () => {
    const checks = buildChecks()
    const evidenceItems = buildEvidenceItems()
    const manualOverrides = [
      {
        dealId: DEAL_ID,
        gateKey: "SOLICITOR_FEEDBACK" as const,
        reason: "Solicitor issue logged and reviewed before progression.",
      },
    ]
    const enforcementResult = evaluateInvestorShield({
      dealId: DEAL_ID,
      checks,
      evidenceItems,
      riskFlags: [],
      manualOverrides,
      deterministicDealStatus: "REVIEW",
      evaluatedAt: FIXED_TIMESTAMP,
    })

    const model = buildInvestorShieldUiModel({
      dealId: DEAL_ID,
      checks,
      evidenceItems,
      enforcementResult,
      manualOverrides,
    })

    const refurbGate = model.gateSummaries.find((gate) => gate.key === "REFURB_CERTAINTY")
    const aiSubGate = refurbGate?.subGates?.find(
      (subGate) => subGate.key === "AI_VISUAL_REVIEW_ADVISORY"
    )
    const titleGate = model.gateSummaries.find((gate) => gate.key === "TITLE")
    const rentalGate = model.gateSummaries.find((gate) => gate.key === "RENTAL_DEMAND")
    const solicitorGate = model.gateSummaries.find((gate) => gate.key === "SOLICITOR_FEEDBACK")

    expect(aiSubGate?.requiredLabel).toBe("Advisory")
    expect(aiSubGate?.advisoryOnly).toBe(true)
    expect(titleGate?.evidenceCount).toBe(1)
    expect(rentalGate?.evidenceCount).toBe(1)
    expect(model.advisoryWarnings).toHaveLength(1)
    expect(model.blockingGateKeys.length).toBeGreaterThan(0)
    expect(model.cautionGateKeys.length).toBeGreaterThan(0)
    expect(model.missingEvidenceGateKeys.length).toBeGreaterThan(0)
    expect(model.taskRecommendations.length).toBeGreaterThan(0)
    expect(refurbGate?.subGates?.some((subGate) => subGate.key === "AI_VISUAL_REVIEW_ADVISORY")).toBe(true)
    expect(solicitorGate?.status).toBe("WAIVED")
    expect(solicitorGate?.waiverReason).toBe("Solicitor issue logged and reviewed before progression.")

    const html = renderToStaticMarkup(<InvestorShieldGateSummaryPanel model={model} />)

    expect(html).toContain("Investor Shield")
    expect(html).toContain("Blocking Gates")
    expect(html).toContain("Caution Gates")
    expect(html).toContain("Missing Evidence Gates")
    expect(html).toContain("Advisory Warnings")
    expect(html).toContain("Investor Shield task recommendations")
    expect(html).toContain("These are read-only due diligence recommendations.")
    expect(html).toContain("Title Review")
    expect(html).toContain("Required")
    expect(html).toContain("Advisory")
    expect(html).toContain("Request evidence")
    expect(html).toContain("Gate: TITLE")
    expect(html).toContain(`>${titleGate?.evidenceCount}<`)
    expect(html).toContain(`>${rentalGate?.evidenceCount}<`)
    expect(html).toContain("Overall Status: BLOCKED")
    expect(html).toContain("AI Visual Review Advisory")
    expect(html).toContain("Missing evidence")
    expect(html).toContain("Manual review required. This does not automatically clear the risk.")
    expect(html).toContain("Waived with reason: Solicitor issue logged and reviewed before progression.")
  })
})
