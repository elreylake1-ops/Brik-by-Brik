import type {
  Phase3ReviewSurfaceDisplayContract,
  Phase3ReviewSurfaceFixturePair,
} from "@/types/phase3-review-surface"

export const PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS: readonly Phase3ReviewSurfaceFixturePair[] = [
  {
    id: "no_deal_with_weak_comparable_hints",
    label: "No Deal with Weak Comparable Hints",
    mergedFixturePath: "__tests__/fixtures/phase3-merged-orchestration/no-deal-with-weak-comparable-hints-merged.json",
    expectedPrimarySection: "deterministic_decision",
    guardrailNotes: [
      "Developer-only advisory review surface.",
      "Capital protection remains dominant over evidence hints.",
      "Merged output is not final approval.",
    ],
    advisoryOnly: true,
  },
  {
    id: "review_required_with_legal_conflict_hints",
    label: "Review Required with Legal Conflict Hints",
    mergedFixturePath:
      "__tests__/fixtures/phase3-merged-orchestration/review-required-with-legal-conflict-hints-merged.json",
    expectedPrimarySection: "deterministic_decision",
    guardrailNotes: [
      "Developer-only advisory review surface.",
      "Deterministic state remains source of truth.",
      "Legal conflict hints are advisory and challengeable.",
    ],
    advisoryOnly: true,
  },
  {
    id: "clean_proceed_with_accepted_operator_note",
    label: "Clean Proceed with Accepted Operator Note",
    mergedFixturePath:
      "__tests__/fixtures/phase3-merged-orchestration/clean-proceed-with-accepted-operator-note-merged.json",
    expectedPrimarySection: "deterministic_decision",
    guardrailNotes: [
      "Developer-only advisory review surface.",
      "Accepted evidence status is not deal approval.",
      "No action CTAs are allowed.",
    ],
    advisoryOnly: true,
  },
  {
    id: "intake_with_missing_lender_hints",
    label: "Intake with Missing Lender Hints",
    mergedFixturePath:
      "__tests__/fixtures/phase3-merged-orchestration/intake-with-missing-lender-hints-merged.json",
    expectedPrimarySection: "deterministic_decision",
    guardrailNotes: [
      "Developer-only advisory review surface.",
      "Intake state remains deterministic and non-decisioning.",
      "Missing lender evidence is advisory only.",
    ],
    advisoryOnly: true,
  },
] as const

export const PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT: Phase3ReviewSurfaceDisplayContract = {
  mode: "developer_fixture_review",
  routeName: "/phase-3-dev-review",
  sections: [
    "deterministic_decision",
    "advisory_merge_summary",
    "capital_protection",
    "merged_tasks",
    "evidence_hints",
    "warnings",
    "metadata",
    "guardrails",
  ],
  fixturePairs: PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS,
  guardrails: [
    "Developer-only route. Not client-facing.",
    "Advisory-only merged output. Deterministic decision remains source of truth.",
    "Capital protection must remain visually dominant when present.",
    "No approve/send-offer/action CTAs.",
    "No runtime wiring, persistence, AI, scraping, or external integrations.",
  ],
  advisoryOnly: true,
}
