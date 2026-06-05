import { describe, expect, it } from "vitest"
import {
  INVESTOR_SHIELD_CONFIDENCE_LEVELS,
  INVESTOR_SHIELD_EVIDENCE_TYPES,
  INVESTOR_SHIELD_GATE_KEYS,
  INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS,
  INVESTOR_SHIELD_SEVERITIES,
  INVESTOR_SHIELD_SOURCES,
  INVESTOR_SHIELD_STATUSES,
} from "@/types/investor-shield"

describe("investor shield type contracts", () => {
  it("exports all required default gate keys", () => {
    expect(INVESTOR_SHIELD_GATE_KEYS).toEqual([
      "SOLD_COMPS",
      "TITLE",
      "LEASEHOLD",
      "PLANNING_BUILDING_CONTROL",
      "REFURB_CERTAINTY",
      "BUILDER_PROPOSAL_CONTRACT",
      "DAMP_STRUCTURAL",
      "LENDER_CRITERIA",
      "RENTAL_DEMAND",
      "SOLICITOR_FEEDBACK",
    ])
  })

  it("exports all required refurb certainty sub-gate keys", () => {
    expect(INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS).toEqual([
      "MEDIA_EVIDENCE_PACK",
      "ROOM_MEASUREMENT_SCHEDULE",
      "AI_VISUAL_REVIEW_ADVISORY",
      "BUILDER_QUOTE_EVIDENCE",
      "SPECIALIST_SURVEY_EVIDENCE",
    ])
  })

  it("exports the locked status, severity, source, confidence, and evidence categories", () => {
    expect(INVESTOR_SHIELD_STATUSES).toEqual([
      "NOT_STARTED",
      "REQUIRED",
      "IN_PROGRESS",
      "SATISFIED",
      "WEAK",
      "FAILED",
      "WAIVED",
    ])

    expect(INVESTOR_SHIELD_SEVERITIES).toEqual(["INFO", "CAUTION", "BLOCKER", "FATAL"])

    expect(INVESTOR_SHIELD_SOURCES).toEqual([
      "user_supplied",
      "document",
      "media",
      "professional",
      "ai_advisory",
      "system_default",
    ])

    expect(INVESTOR_SHIELD_CONFIDENCE_LEVELS).toEqual([
      "HIGH",
      "MEDIUM",
      "LOW",
      "UNKNOWN",
    ])

    expect(INVESTOR_SHIELD_EVIDENCE_TYPES).toEqual([
      "SOLD_COMPARABLE",
      "TITLE_DOCUMENT",
      "LEASE_DOCUMENT",
      "PLANNING_DOCUMENT",
      "BUILDING_CONTROL_DOCUMENT",
      "REFURB_PHOTO",
      "REFURB_VIDEO",
      "ROOM_MEASUREMENT",
      "BUILDER_QUOTE",
      "BUILDER_PROPOSAL",
      "BUILDER_CONTRACT",
      "SPECIALIST_SURVEY",
      "LENDER_CRITERIA",
      "RENTAL_EVIDENCE",
      "SOLICITOR_FEEDBACK",
      "MANUAL_NOTE",
      "OTHER",
    ])
  })
})
