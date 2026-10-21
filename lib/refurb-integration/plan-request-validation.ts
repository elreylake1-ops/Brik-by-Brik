import { parseDealInputs } from "@/lib/operator-command/derive-saved-deal-record"
import type { KitchenSize } from "@/types/scope"
import type { AcceptedItemSelection, FinancialAssumptions, PropertyBasics } from "@/types/refurb-integration"

// Strict request parsing for the refurbishment plan endpoints. Unknown keys are rejected; nothing identity-,
// governance- or result-related is read from a body (a request cannot supply a cost, a verdict or a reviewer).

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/
const SET_ID_PATTERN = /^[A-Za-z0-9:_.-]{1,150}$/
const ITEM_ID_PATTERN = /^[a-z0-9-]{1,40}(:inspect)?$/
const KITCHEN_SIZES: readonly KitchenSize[] = ["small", "medium", "large"]

function unknownKeys(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body).filter((k) => !allowed.includes(k)).map((k) => `Unknown field: ${k}`)
}

export function parsePropertyBasics(v: unknown): Parsed<PropertyBasics> {
  if (!isObject(v)) return { ok: false, errors: ["propertyBasics must be an object"] }
  const errors = unknownKeys(v, ["bedrooms", "bathrooms", "floorAreaSqm", "kitchenSize"]).map((e) => `propertyBasics: ${e}`)
  const { bedrooms, bathrooms, floorAreaSqm, kitchenSize } = v
  const int = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 50
  if (!int(bedrooms)) errors.push("propertyBasics.bedrooms must be a whole number from 0 to 50")
  if (!int(bathrooms)) errors.push("propertyBasics.bathrooms must be a whole number from 0 to 50")
  if (floorAreaSqm !== undefined && !(typeof floorAreaSqm === "number" && Number.isFinite(floorAreaSqm) && floorAreaSqm > 0 && floorAreaSqm <= 10_000)) {
    errors.push("propertyBasics.floorAreaSqm must be a number above 0 and at most 10000")
  }
  if (typeof kitchenSize !== "string" || !KITCHEN_SIZES.includes(kitchenSize as KitchenSize)) errors.push("propertyBasics.kitchenSize must be small, medium or large")
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      bedrooms: bedrooms as number,
      bathrooms: bathrooms as number,
      ...(floorAreaSqm !== undefined ? { floorAreaSqm: floorAreaSqm as number } : {}),
      kitchenSize: kitchenSize as KitchenSize,
    },
  }
}

export function parseFinancialAssumptions(v: unknown): Parsed<FinancialAssumptions> {
  if (!isObject(v)) return { ok: false, errors: ["financialAssumptions must be an object"] }
  const errors = unknownKeys(v, ["stampDuty", "legalCosts", "saleCosts", "bridgeTermMonths"]).map((e) => `financialAssumptions: ${e}`)
  // Reuse the Saved Deal input bounds (finite, non-negative, capped) rather than defining new ones.
  const checked = parseDealInputs({ purchasePrice: 0, gdv: 0, refurbCost: 0, ...v })
  if (!checked) errors.push("financialAssumptions needs numeric stampDuty, legalCosts, saleCosts and bridgeTermMonths within sensible bounds")
  if (errors.length || !checked) return { ok: false, errors }
  return { ok: true, value: { stampDuty: checked.stampDuty, legalCosts: checked.legalCosts, saleCosts: checked.saleCosts, bridgeTermMonths: checked.bridgeTermMonths } }
}

function parseAccepted(v: unknown): Parsed<AcceptedItemSelection[]> {
  if (!Array.isArray(v) || v.length > 60) return { ok: false, errors: ["accepted must be a list of at most 60 items"] }
  const errors: string[] = []
  const out: AcceptedItemSelection[] = []
  v.forEach((entry, i) => {
    if (!isObject(entry)) return void errors.push(`accepted[${i}] must be an object`)
    errors.push(...unknownKeys(entry, ["itemId", "level"]).map((e) => `accepted[${i}]: ${e}`))
    if (typeof entry.itemId !== "string" || !ITEM_ID_PATTERN.test(entry.itemId)) return void errors.push(`accepted[${i}].itemId is invalid`)
    if (entry.level !== undefined && typeof entry.level !== "string" && typeof entry.level !== "boolean") return void errors.push(`accepted[${i}].level must be a string or boolean`)
    out.push({ itemId: entry.itemId, ...(entry.level !== undefined ? { level: entry.level as string | boolean } : {}) })
  })
  return errors.length ? { ok: false, errors } : { ok: true, value: out }
}

export type PreviewRequest = {
  accepted?: AcceptedItemSelection[]
  propertyBasics?: PropertyBasics
  /** A recorded measurement set (must be the current version). Alternative to propertyBasics. */
  measurementSetId?: string
  financialAssumptions?: FinancialAssumptions
}

export function parsePreviewRequest(body: unknown): Parsed<PreviewRequest> {
  if (!isObject(body)) return { ok: false, errors: ["Body must be a JSON object"] }
  const errors = unknownKeys(body, ["accepted", "propertyBasics", "measurementSetId", "financialAssumptions"])
  const value: PreviewRequest = {}
  if (body.accepted !== undefined) {
    const p = parseAccepted(body.accepted)
    if (p.ok) value.accepted = p.value
    else errors.push(...p.errors)
  }
  if (body.propertyBasics !== undefined) {
    const p = parsePropertyBasics(body.propertyBasics)
    if (p.ok) value.propertyBasics = p.value
    else errors.push(...p.errors)
  }
  if (body.measurementSetId !== undefined) {
    if (typeof body.measurementSetId !== "string" || !SET_ID_PATTERN.test(body.measurementSetId)) errors.push("measurementSetId is invalid")
    else value.measurementSetId = body.measurementSetId
    if (body.propertyBasics !== undefined) errors.push("Send either propertyBasics or measurementSetId, not both")
  }
  if (body.financialAssumptions !== undefined && body.financialAssumptions !== null) {
    const p = parseFinancialAssumptions(body.financialAssumptions)
    if (p.ok) value.financialAssumptions = p.value
    else errors.push(...p.errors)
  }
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

export type ConfirmRequest = {
  idempotencyKey: string
  expectedFingerprint: string
  accepted: AcceptedItemSelection[]
  /** Exactly one of these two. measurementSetId is the preferred path: quantities then carry how they are known. */
  propertyBasics?: PropertyBasics
  measurementSetId?: string
  financialAssumptions: FinancialAssumptions | null
}

export function parseConfirmRequest(body: unknown): Parsed<ConfirmRequest> {
  if (!isObject(body)) return { ok: false, errors: ["Body must be a JSON object"] }
  const errors = unknownKeys(body, ["idempotencyKey", "expectedFingerprint", "accepted", "propertyBasics", "measurementSetId", "financialAssumptions"])
  if (typeof body.idempotencyKey !== "string" || !KEY_PATTERN.test(body.idempotencyKey)) errors.push("idempotencyKey must be 8-100 characters of A-Z a-z 0-9 _ -")
  if (typeof body.expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedFingerprint)) errors.push("expectedFingerprint must be the fingerprint of the proposal that was reviewed")
  const accepted = parseAccepted(body.accepted)
  if (!accepted.ok) errors.push(...accepted.errors)
  else if (accepted.value.length === 0) errors.push("accepted must contain at least one item")
  let basics: Parsed<PropertyBasics> | null = null
  let measurementSetId: string | undefined
  if (body.propertyBasics !== undefined && body.measurementSetId !== undefined) errors.push("Send either propertyBasics or measurementSetId, not both")
  else if (body.measurementSetId !== undefined) {
    if (typeof body.measurementSetId !== "string" || !SET_ID_PATTERN.test(body.measurementSetId)) errors.push("measurementSetId is invalid")
    else measurementSetId = body.measurementSetId
  } else {
    basics = parsePropertyBasics(body.propertyBasics)
    if (!basics.ok) errors.push(...basics.errors)
  }
  let assumptions: FinancialAssumptions | null = null
  if (body.financialAssumptions !== undefined && body.financialAssumptions !== null) {
    const p = parseFinancialAssumptions(body.financialAssumptions)
    if (p.ok) assumptions = p.value
    else errors.push(...p.errors)
  }
  if (errors.length || !accepted.ok) return { ok: false, errors }
  return {
    ok: true,
    value: {
      idempotencyKey: body.idempotencyKey as string,
      expectedFingerprint: body.expectedFingerprint as string,
      accepted: accepted.value,
      ...(basics && basics.ok ? { propertyBasics: basics.value } : {}),
      ...(measurementSetId ? { measurementSetId } : {}),
      financialAssumptions: assumptions,
    },
  }
}
