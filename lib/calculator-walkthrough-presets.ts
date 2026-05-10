import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

export type CalculatorWalkthroughPreset = {
  id: string
  label: string
  filename: string
  useScope: boolean
  inputs: DealInputs
  scope: RefurbScopeInput
}

type CalculatorWalkthroughPresetState = {
  useScope: boolean
  inputs: DealInputs
  scope: RefurbScopeInput
}

const EMPTY_REFURB_COST = 0

const STANDARD_WALKTHROUGH_SCOPE: RefurbScopeInput = {
  bedrooms: 2,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

const HEAVY_REFURB_SCOPE: RefurbScopeInput = {
  bedrooms: 4,
  bathrooms: 2,
  floorAreaSqm: 120,
  kitchen: { scope: "full_replace", size: "large" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: true, roof: true },
}

const UNSUPPORTED_SCOPE_WALKTHROUGH_SCOPE: RefurbScopeInput = {
  bedrooms: 2,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "refresh", size: "medium" },
  bathroom: { scope: "cosmetic" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: false },
  majorWorks: { rewire: false, boiler: false, roof: false },
}

const CAPITAL_EXPOSURE_SCOPE: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

const LARGE_KITCHEN_SCOPE: RefurbScopeInput = {
  ...STANDARD_WALKTHROUGH_SCOPE,
  kitchen: { scope: "full_replace", size: "large" },
}

const TWO_BATHROOM_SCOPE: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 2,
  floorAreaSqm: 120,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

const FLOORING_AREA_SCOPE: RefurbScopeInput = {
  ...STANDARD_WALKTHROUGH_SCOPE,
  floorAreaSqm: 120,
}

const MAJOR_WORKS_SCOPE: RefurbScopeInput = {
  ...STANDARD_WALKTHROUGH_SCOPE,
  majorWorks: { rewire: true, boiler: true, roof: true },
}

function buildInputs(overrides: Partial<DealInputs>): DealInputs {
  return {
    purchasePrice: 0,
    gdv: 0,
    refurbCost: EMPTY_REFURB_COST,
    stampDuty: 0,
    legalCosts: 0,
    saleCosts: 0,
    bridgeTermMonths: 0,
    ...overrides,
  }
}

function cloneScope(scope: RefurbScopeInput): RefurbScopeInput {
  return {
    bedrooms: scope.bedrooms,
    bathrooms: scope.bathrooms,
    floorAreaSqm: scope.floorAreaSqm,
    kitchen: { ...scope.kitchen },
    bathroom: { ...scope.bathroom },
    bedroom: { ...scope.bedroom },
    flooring: { ...scope.flooring },
    majorWorks: { ...scope.majorWorks },
  }
}

function cloneInputs(inputs: DealInputs): DealInputs {
  return { ...inputs }
}

export const CALCULATOR_WALKTHROUGH_PRESETS: CalculatorWalkthroughPreset[] = [
  {
    id: "01-strong-profitable-deal",
    label: "01 — Strong profitable deal",
    filename: "01-calculator-strong-profitable-deal.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 105000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "02-marginal-renegotiate-deal",
    label: "02 — Marginal / renegotiate deal",
    filename: "02-calculator-marginal-renegotiate-deal.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 150000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "03-no-go-negative-profit-deal",
    label: "03 — No-go / negative-profit deal",
    filename: "03-calculator-no-go-negative-profit-deal.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 190000,
      gdv: 200000,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "04-downside-sensitive-deal",
    label: "04 — Downside-sensitive deal",
    filename: "04-calculator-downside-sensitive-deal.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 135000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "05-heavy-refurb-exposure",
    label: "05 — Heavy refurb exposure",
    filename: "05-calculator-heavy-refurb-exposure.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: HEAVY_REFURB_SCOPE,
  },
  {
    id: "06-high-finance-long-bridge-term",
    label: "06 — High finance / long bridge term",
    filename: "06-calculator-high-finance-long-bridge-term.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 18,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "07-zero-refurb-edge-case",
    label: "07 — Zero refurb edge case",
    filename: "07-calculator-zero-refurb-edge-case.png",
    useScope: false,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      refurbCost: 0,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "08-unsupported-scope-warning",
    label: "08 — Unsupported scope warning",
    filename: "08-calculator-unsupported-scope-warning.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: UNSUPPORTED_SCOPE_WALKTHROUGH_SCOPE,
  },
  {
    id: "09-capital-exposure-caution",
    label: "09 — Capital exposure caution",
    filename: "09-calculator-capital-exposure-caution.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: CAPITAL_EXPOSURE_SCOPE,
  },
  {
    id: "10-high-purchase-mao-fail",
    label: "10 — High purchase / MAO fail",
    filename: "10-calculator-high-purchase-mao-fail.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 160000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: STANDARD_WALKTHROUGH_SCOPE,
  },
  {
    id: "11-large-kitchen-cost-impact",
    label: "11 — Large kitchen cost impact",
    filename: "11-calculator-large-kitchen-cost-impact.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: LARGE_KITCHEN_SCOPE,
  },
  {
    id: "12-two-bathroom-scaling",
    label: "12 — Two-bathroom scaling",
    filename: "12-calculator-two-bathroom-scaling.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: TWO_BATHROOM_SCOPE,
  },
  {
    id: "13-flooring-area-scaling",
    label: "13 — Flooring area scaling",
    filename: "13-calculator-flooring-area-scaling.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: FLOORING_AREA_SCOPE,
  },
  {
    id: "14-major-works-impact",
    label: "14 — Major works impact",
    filename: "14-calculator-major-works-impact.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: MAJOR_WORKS_SCOPE,
  },
  {
    id: "15-missing-scope-completeness-guard",
    label: "15 — Missing scope completeness guard",
    filename: "15-calculator-missing-scope-completeness-guard.png",
    useScope: true,
    inputs: buildInputs({
      purchasePrice: 120000,
      gdv: 200000,
      stampDuty: 6500,
      legalCosts: 2000,
      saleCosts: 3000,
      bridgeTermMonths: 6,
    }),
    scope: UNSUPPORTED_SCOPE_WALKTHROUGH_SCOPE,
  },
]

export function getCalculatorWalkthroughPresetState(
  presetId: string
): CalculatorWalkthroughPresetState | undefined {
  const preset = CALCULATOR_WALKTHROUGH_PRESETS.find((entry) => entry.id === presetId)

  if (!preset) {
    return undefined
  }

  return {
    useScope: preset.useScope,
    inputs: cloneInputs(preset.inputs),
    scope: cloneScope(preset.scope),
  }
}
