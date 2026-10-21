import type { PropertyBasics } from "@/types/refurb-integration"

// Operator-entered measurements and quantity assumptions for a viewing assessment.
//
// Principles:
//  - Every value is entered by a person. Nothing here is read, measured or inferred from video frames, and no source
//    value exists for "video": a request that tries is rejected.
//  - Each value says HOW it is known (measured / operator estimate / unknown), by what means, with what confidence and why.
//  - Only the engine-supported quantities (bedrooms, bathrooms, floor area, kitchen size) feed the existing engine. Every
//    other measurement is recorded for builders and for the audit trail, and is never turned into a price.
//  - Sets are append-only versions. A correction is a new version with a reason; earlier versions stay readable.

export const MEASUREMENT_BASES = ["MEASURED", "OPERATOR_ESTIMATE", "UNKNOWN"] as const
export type MeasurementBasis = typeof MEASUREMENT_BASES[number]

export const MEASUREMENT_SOURCES = ["TAPE_MEASURE", "LASER_MEASURE", "FLOOR_PLAN", "EPC_OR_LISTING", "AGENT_OR_VENDOR", "OTHER"] as const
export type MeasurementSource = typeof MEASUREMENT_SOURCES[number]

export const MEASUREMENT_CONFIDENCE = ["high", "medium", "low"] as const
export type MeasurementConfidence = typeof MEASUREMENT_CONFIDENCE[number]

export type MeasurementUnit = "count" | "sqm" | "m" | "category"

export type MeasurementEntry = {
  key: string // one of MEASUREMENT_SPEC
  room?: string // required for per-room dimensions
  value: number | string | null // null only when basis is UNKNOWN
  unit: MeasurementUnit
  basis: MeasurementBasis
  source: MeasurementSource | null // null only when basis is UNKNOWN
  confidence: MeasurementConfidence | null
  note: string // required for estimates and unknowns
  /** Set when a value outside the plausible range was entered deliberately. */
  acknowledgedImplausible?: boolean
}

export type MeasurementWarning = { code: string; key?: string; room?: string; message: string }

export type MeasurementSetRecord = {
  id: string
  dealId: string
  assessmentId: string
  version: number
  basedOnVersion: number // 0 for the first set
  idempotencyKey: string
  entries: MeasurementEntry[]
  warnings: MeasurementWarning[]
  changeNote: string | null // required from version 2: why the earlier version was wrong or incomplete
  recordedBy: string
  recordedAt: string
}

/** How the engine inputs were assembled from a measurement set. */
export type MeasurementBasics = {
  basics: PropertyBasics | null
  /** Why costing cannot run (e.g. BEDROOMS_UNKNOWN). Empty when the engine can be called. */
  blockedBy: string[]
  /** One line per engine quantity saying how it is known. */
  basisNotes: string[]
  /** Quantities that are unknown, only estimated, or missing, in plain words. */
  unresolved: string[]
}

export type MeasurementChange = { key: string; room?: string; change: "ADDED" | "REMOVED" | "CHANGED"; from: string | null; to: string | null }
