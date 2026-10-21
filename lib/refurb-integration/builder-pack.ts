import { BUILDER_INSPECTION_NOTE, BUILDER_PACK_EXCLUSIONS, builderNoteFor } from "@/lib/data/finding-work-mapping"
import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import type { BuilderPackItem, BuilderPackMeasurement, BuilderQuotePack, DraftMarker } from "@/types/deal-documents"
import type { ConfirmedWorkItem, CurrentPlanView } from "@/types/refurb-integration"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"

// Builder quotation-request pack: a DRAFT for the operator to review before anything goes to a builder.
//
// CONFIDENTIALITY (enforced by tests that scan the output): this pack never carries
//   - the proprietary engine's rates, labour days, schedule or allowances,
//   - our internal refurbishment estimate or any cost figure,
//   - the Saved Deal's prices, investor profit, return or MAO figures, verdicts, thresholds,
//   - Investor Shield, governance or capital-protection information,
//   - operator or reviewer identities.
// It carries the reviewed scope, the recorded measurements (with how each is known), quantity assumptions, evidence
// references (frame and time), exclusions, and a blank pricing sheet for the builder to complete.

export const SIMULATED_WARNING =
  "Some or all findings behind this document come from SIMULATED (fixture) analysis. Treat it as a demonstration, not as an inspection result."

export function draftMarker(analysisSource: string | null): DraftMarker {
  return {
    status: "DRAFT",
    approval: "NOT_APPROVED",
    simulatedDataWarning: analysisSource === "SIMULATED" || analysisSource === "MIXED" ? SIMULATED_WARNING : null,
  }
}

function scopeText(item: ConfirmedWorkItem): string {
  if (item.kind === "SPECIALIST_INSPECTION") return BUILDER_INSPECTION_NOTE
  if (!item.scopeEffect) return `${item.label}: nature and extent to be established by the builder.`
  const level = item.scopeEffect.level
  const humanLevel = typeof level === "boolean" ? "works required (extent to be confirmed)" : String(level).replace(/_/g, " ")
  return `${item.label}: ${humanLevel}${item.levelChosenByHuman ? " (level chosen by the reviewing operator)" : " (level proposed from the finding)"}.`
}

function measurementRows(set: MeasurementSetRecord | null, view: CurrentPlanView): BuilderPackMeasurement[] {
  if (set) {
    return set.entries.map((e) => ({
      label: MEASUREMENT_SPEC[e.key]?.label ?? e.key,
      ...(e.room ? { room: e.room } : {}),
      value: e.value,
      unit: e.unit,
      basis: e.basis,
      source: e.source,
      confidence: e.confidence,
      note: e.note,
    }))
  }
  // A plan confirmed with typed-in quantities (no measurement record): shown as the operator's own figures, not measurements.
  const b = view.record.propertyBasics
  const typed = (label: string, value: number | string | undefined, unit: BuilderPackMeasurement["unit"]): BuilderPackMeasurement[] =>
    value === undefined ? [] : [{ label, value, unit, basis: "OPERATOR_ESTIMATE", source: null, confidence: null, note: "Figure supplied by the operator; no measurement record." }]
  return [...typed("Bedrooms", b.bedrooms, "count"), ...typed("Bathrooms", b.bathrooms, "count"), ...typed("Total floor area", b.floorAreaSqm, "sqm"), ...typed("Kitchen size", b.kitchenSize, "category")]
}

export function buildBuilderQuotePack(input: {
  generatedAt: string
  dealRef: { dealId: string; address: string }
  view: CurrentPlanView
  measurementSet: MeasurementSetRecord | null
}): BuilderQuotePack {
  const { record, stale } = input.view
  const rows = measurementRows(input.measurementSet, input.view)
  const items: BuilderPackItem[] = record.acceptedItems.map((item) => ({
    itemId: item.itemId,
    label: item.label,
    area: item.area,
    kind: item.kind,
    scopeRequested: scopeText(item),
    quantityBasis: item.kind === "SPECIALIST_INSPECTION" ? BUILDER_INSPECTION_NOTE : builderNoteFor(item.mappingId),
    priceRequested: item.kind !== "SPECIALIST_INSPECTION",
    specialistInspectionRequired: item.kind === "SPECIALIST_INSPECTION",
    needsBuilderVerification: true,
    evidence: item.sources.flatMap((s) => s.evidence.map((e) => ({ evidenceId: e.evidenceId, timestampSeconds: e.timestampSeconds, ...(e.room ? { room: e.room } : {}), observation: s.reviewedObservation }))),
  }))

  const unknown = rows.filter((r) => r.basis === "UNKNOWN")
  const estimated = rows.filter((r) => r.basis === "OPERATOR_ESTIMATE")
  const verification = [
    ...items.filter((i) => i.priceRequested).map((i) => `${i.label}: ${i.quantityBasis}`),
    ...estimated.map((r) => `${r.label}${r.room ? ` (${r.room})` : ""} is an estimate (${r.value}${r.unit === "category" ? "" : ` ${r.unit}`}): please check on site.`),
    ...unknown.map((r) => `${r.label}${r.room ? ` (${r.room})` : ""} is not known: please establish it on site.`),
  ]

  return {
    ...draftMarker(record.analysisSource),
    kind: "BUILDER_QUOTATION_REQUEST_PACK",
    version: "builder-pack-v2",
    generatedAt: input.generatedAt,
    dealRef: input.dealRef,
    assessmentId: record.assessmentId,
    plan: { planId: record.id, version: record.version, confirmedAt: record.confirmedAt, stale },
    measurements: {
      setVersion: input.measurementSet?.version ?? null,
      recordedAt: input.measurementSet?.recordedAt ?? null,
      entries: rows,
      statement: "Figures marked MEASURED were taken by the operator with a tape, laser or scaled plan. ESTIMATE means a stated or approximate figure. UNKNOWN means not yet established. None were derived from video.",
    },
    items,
    assumptions: [
      "Scope items come from a recorded video review in which a person confirmed each finding. Condition behind finishes, structure, damp, services and drainage is unknown.",
      "Areas with no listed item have no confirmed finding. That is not a statement that they are sound.",
      ...(unknown.length ? ["Some quantities are unknown; where you need them to price, please state the quantity you have assumed."] : []),
    ],
    exclusions: [...BUILDER_PACK_EXCLUSIONS],
    builderVerificationRequired: [...new Set(verification)],
    requestedFromBuilder: [
      "An itemised price for each item in the pricing sheet, stating what is and is not included.",
      "Confirmation of quantities and extent after a site visit.",
      "A programme with durations and dependencies.",
      "The basis on which variations would be priced.",
      "Any further inspections or surveys needed before a firm price.",
    ],
    pricingSheet: {
      instructions: "Please complete the blank fields for each item you are pricing. Leave an item blank if you decline to price it, and say why in the notes.",
      lines: items.filter((i) => i.priceRequested).map((i) => ({ itemId: i.itemId, label: i.label, priceExcludingVat: null, includes: null, excludes: null, durationWorkingDays: null, notes: null })),
      totalExcludingVat: null,
      vatTreatment: null,
      earliestStart: null,
      quoteValidForDays: null,
      builderName: null,
      builderContact: null,
    },
    confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false, investorFiguresIncluded: false, governanceInformationIncluded: false },
    disclaimers: [
      "DRAFT for operator review before sending. This is a request for quotations, not a quotation, a contract or an instruction to start works.",
      "Findings come from a recorded video review, not a survey.",
      "Measurement notes and observations are the reviewing operator's own wording; review them before this pack leaves the business.",
      ...(stale ? ["The underlying findings or measurements have changed since this plan was confirmed. Re-confirm the plan before relying on this pack."] : []),
    ],
  }
}
