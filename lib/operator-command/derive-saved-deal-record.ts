import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import type { DealInputs } from "@/types/deal"
import type { BathroomScope, BedroomScope, KitchenScope, KitchenSize, RefurbScopeInput } from "@/types/scope"
import type { CreateSavedDealInput } from "@/lib/operator-command/saved-deals-repository"

// Server-side derivation of everything authoritative about a new saved deal.
//
// The browser may send only the deal INPUTS (and the optional refurb scope). Classification, governance state, capital
// protection state, pipeline state, refurb cost and the stored engine result are all produced here by running the
// existing deterministic engine (analyzeDealWithRefurb) - the same function the calculator page uses, not a second
// engine. A browser-supplied value for any derived field is rejected rather than trusted or silently overwritten, and
// AI output never feeds this path.

export const DERIVED_FIELDS = [
  "classification",
  "governance_state",
  "capital_protection_state",
  "pipeline_state",
  "engine_result_json",
  "risk_summary_json",
  "purchase_price",
  "gdv_realistic",
  "refurb_cost",
] as const

const MAX_MONEY = 1_000_000_000
const num = (v: unknown, max = MAX_MONEY): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

export function parseDealInputs(v: unknown): DealInputs | null {
  if (!isObject(v)) return null
  const { purchasePrice, gdv, refurbCost, stampDuty, legalCosts, saleCosts, bridgeTermMonths } = v
  if (![purchasePrice, gdv, refurbCost, stampDuty, legalCosts, saleCosts].every((x) => num(x)) || !num(bridgeTermMonths, 120)) return null
  return { purchasePrice, gdv, refurbCost, stampDuty, legalCosts, saleCosts, bridgeTermMonths } as DealInputs
}

export function parseScope(v: unknown): RefurbScopeInput | null {
  if (!isObject(v) || !isObject(v.kitchen) || !isObject(v.bathroom) || !isObject(v.bedroom) || !isObject(v.flooring) || !isObject(v.majorWorks)) return null
  const { bedrooms, bathrooms, floorAreaSqm } = v
  if (!num(bedrooms, 50) || !num(bathrooms, 50) || !Number.isInteger(bedrooms) || !Number.isInteger(bathrooms)) return null
  if (floorAreaSqm !== undefined && !num(floorAreaSqm, 10_000)) return null
  const k = v.kitchen, b = v.bathroom, br = v.bedroom, f = v.flooring, m = v.majorWorks
  if (!oneOf<KitchenScope>(k.scope, ["keep", "refresh", "upgrade", "full_replace"]) || !oneOf<KitchenSize>(k.size, ["small", "medium", "large"])) return null
  if (!oneOf<BathroomScope>(b.scope, ["cosmetic", "partial", "full_replace"])) return null
  if (!oneOf<BedroomScope>(br.scope, ["none", "paint", "flooring", "full_refurb", "cosmetic_refresh"])) return null
  if (typeof f.replaceWholeProperty !== "boolean" || typeof m.rewire !== "boolean" || typeof m.boiler !== "boolean" || typeof m.roof !== "boolean") return null
  return {
    bedrooms,
    bathrooms,
    ...(floorAreaSqm !== undefined ? { floorAreaSqm } : {}),
    kitchen: { scope: k.scope, size: k.size },
    bathroom: { scope: b.scope },
    bedroom: { scope: br.scope },
    flooring: { replaceWholeProperty: f.replaceWholeProperty },
    majorWorks: { rewire: m.rewire, boiler: m.boiler, roof: m.roof },
  }
}

export type DeriveResult = { ok: true; record: CreateSavedDealInput } | { ok: false; error: string }

export function deriveSavedDealRecord(body: Record<string, unknown>): DeriveResult {
  const forged = DERIVED_FIELDS.filter((f) => body[f] !== undefined)
  if (forged.length > 0) return { ok: false, error: `Fields are computed by the server and must not be sent: ${forged.join(", ")}.` }

  if (typeof body.address !== "string" || body.address.trim().length === 0 || body.address.length > 500) return { ok: false, error: "Invalid input: address is required." }
  if (body.listing_url !== undefined && body.listing_url !== null && (typeof body.listing_url !== "string" || body.listing_url.length > 2000)) return { ok: false, error: "Invalid input: optional text fields must be string or null." }
  if (body.next_action !== undefined && body.next_action !== null && (typeof body.next_action !== "string" || body.next_action.length > 2000)) return { ok: false, error: "Invalid input: optional text fields must be string or null." }

  const inputs = parseDealInputs(body.deal_inputs)
  if (!inputs) return { ok: false, error: "Invalid input: deal_inputs is required and must contain valid non-negative numbers." }
  let scope: RefurbScopeInput | undefined
  if (body.scope !== undefined && body.scope !== null) {
    const parsed = parseScope(body.scope)
    if (!parsed) return { ok: false, error: "Invalid input: scope is malformed." }
    scope = parsed
  }

  const result = analyzeDealWithRefurb(inputs, scope)
  return {
    ok: true,
    record: {
      address: body.address.trim(),
      listing_url: (body.listing_url as string | null | undefined) ?? null,
      purchase_price: inputs.purchasePrice,
      gdv_realistic: inputs.gdv,
      refurb_cost: result.refurbSource === "generated" ? (result.refurb?.totalRefurbCost ?? inputs.refurbCost) : inputs.refurbCost,
      classification: result.dueDiligence?.decision.dealClassification ?? result.verdict.status,
      governance_state: result.verdict.status,
      capital_protection_state: result.dueDiligence?.decision.capitalProtectionStatus ?? "UNKNOWN",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: result as unknown as Record<string, unknown>,
      risk_summary_json: { riskFlags: result.dueDiligence?.decision.riskFlags ?? [], warnings: result.warnings },
      next_action: (body.next_action as string | null | undefined) ?? null,
    },
  }
}
