// Display contracts only for a future developer review surface.
// No route/UI/runtime behavior is implemented by this file.
// Deterministic decision must render before advisory sections.
// Merged advisory output must not be treated as final approval.
// No action CTAs (approve/send-offer/automations) are allowed.

export const PHASE3_REVIEW_SURFACE_MODES = ["developer_fixture_review"] as const

export type Phase3ReviewSurfaceMode = typeof PHASE3_REVIEW_SURFACE_MODES[number]

export const PHASE3_REVIEW_SURFACE_SECTIONS = [
  "deterministic_decision",
  "advisory_merge_summary",
  "capital_protection",
  "merged_tasks",
  "evidence_hints",
  "warnings",
  "metadata",
  "guardrails",
] as const

export type Phase3ReviewSurfaceSection = typeof PHASE3_REVIEW_SURFACE_SECTIONS[number]

export const PHASE3_REVIEW_SURFACE_FIXTURE_IDS = [
  "no_deal_with_weak_comparable_hints",
  "review_required_with_legal_conflict_hints",
  "clean_proceed_with_accepted_operator_note",
  "intake_with_missing_lender_hints",
] as const

export type Phase3ReviewSurfaceFixtureId = typeof PHASE3_REVIEW_SURFACE_FIXTURE_IDS[number]

export type Phase3ReviewSurfaceFixturePair = {
  id: Phase3ReviewSurfaceFixtureId
  label: string
  mergedFixturePath: string
  expectedPrimarySection: Phase3ReviewSurfaceSection
  guardrailNotes: readonly string[]
  advisoryOnly: true
}

export type Phase3ReviewSurfaceDisplayContract = {
  mode: Phase3ReviewSurfaceMode
  routeName: string
  sections: readonly Phase3ReviewSurfaceSection[]
  fixturePairs: readonly Phase3ReviewSurfaceFixturePair[]
  guardrails: readonly string[]
  advisoryOnly: true
}
