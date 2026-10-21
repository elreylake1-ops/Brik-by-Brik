// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import BuilderPackView from "@/components/refurb-plan/BuilderPackView"
import type { BuilderQuotePack } from "@/types/deal-documents"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const samplePack: BuilderQuotePack = {
  kind: "BUILDER_QUOTATION_REQUEST_PACK",
  version: "builder-pack-v2",
  status: "DRAFT",
  approval: "NOT_APPROVED",
  simulatedDataWarning: "Demonstration data only.",
  generatedAt: "2026-10-21T12:00:00.000Z",
  dealRef: { dealId: "deal-123", address: "14 Elm Street, Manchester" },
  assessmentId: "asmt-999",
  plan: {
    planId: "plan-1",
    version: 2,
    confirmedAt: "2026-10-21T11:45:00.000Z",
    stale: false,
  },
  measurements: {
    setVersion: 1,
    recordedAt: "2026-10-21T11:30:00.000Z",
    statement: "Operator recorded dimensions via tape measure.",
    entries: [
      {
        label: "Bedrooms",
        value: 3,
        unit: "count",
        basis: "MEASURED",
        source: "TAPE_MEASURE",
        confidence: "high",
        note: "Verified ground and first floor",
      },
      {
        label: "Bathrooms",
        value: 1,
        unit: "count",
        basis: "MEASURED",
        source: "TAPE_MEASURE",
        confidence: "high",
        note: "Family bathroom",
      },
      {
        label: "Total floor area",
        value: 85,
        unit: "sqm",
        basis: "MEASURED",
        source: "LASER_MEASURE",
        confidence: "high",
        note: "Internal usable area",
      },
    ],
  },
  items: [
    {
      itemId: "roof_replacement_tiles",
      label: "Roof Tile Replacement",
      area: "roof",
      kind: "ENGINE_SCOPE",
      scopeRequested: "Strip slipped tiles and replace underlay and batten.",
      quantityBasis: "Main roof slope approx 60 sqm.",
      priceRequested: true,
      specialistInspectionRequired: false,
      needsBuilderVerification: true,
      evidence: [
        {
          evidenceId: "ev-1",
          timestampSeconds: 14.5,
          room: "Rear exterior",
          observation: "Slipped tiles on rear slope.",
        },
      ],
    },
    {
      itemId: "masonry_repointing",
      label: "Masonry Repointing",
      area: "external_walls",
      kind: "UNPRICED",
      scopeRequested: "Rake out decayed mortar and repoint.",
      quantityBasis: "Gable end approx 15 sqm.",
      priceRequested: true,
      specialistInspectionRequired: true,
      needsBuilderVerification: true,
      evidence: [
        {
          evidenceId: "ev-2",
          timestampSeconds: 32.0,
          room: "Gable",
          observation: "Cracked mortar joints near window.",
        },
      ],
    },
  ],
  assumptions: ["Standard lime-mortar mix for external pointing."],
  exclusions: ["Internal decoration not included in building quote."],
  builderVerificationRequired: ["Verify roof pitch and access"],
  requestedFromBuilder: ["Fixed quotation excluding VAT"],
  pricingSheet: {
    instructions: "Please price all lines excluding VAT.",
    lines: [
      {
        itemId: "roof_replacement_tiles",
        label: "Roof Tile Replacement",
        priceExcludingVat: null,
        includes: null,
        excludes: null,
        durationWorkingDays: null,
        notes: null,
      },
      {
        itemId: "masonry_repointing",
        label: "Masonry Repointing",
        priceExcludingVat: null,
        includes: null,
        excludes: null,
        durationWorkingDays: null,
        notes: null,
      },
    ],
    totalExcludingVat: null,
    vatTreatment: null,
    earliestStart: null,
    quoteValidForDays: null,
    builderName: null,
    builderContact: null,
  },
  confidentiality: {
    internalEstimateIncluded: false,
    engineRatesIncluded: false,
    investorFiguresIncluded: false,
    governanceInformationIncluded: false,
  },
  disclaimers: ["Subject to contractor site survey."],
}

describe("BuilderPackView component", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("renders draft header, property address, and confidentiality notice", () => {
    act(() => root.render(<BuilderPackView pack={samplePack} />))

    expect(container.textContent).toContain("Builder Quotation Request Pack")
    expect(container.textContent).toContain("14 Elm Street, Manchester")
    expect(container.textContent).toContain("Version 2")
    expect(container.textContent).toContain("DRAFT · NOT APPROVED")
    expect(container.textContent).toContain("Confidentiality Notice")
    expect(container.textContent).toContain("Demonstration Notice: Demonstration data only.")
  })

  it("renders recorded measurements with source and confidence", () => {
    act(() => root.render(<BuilderPackView pack={samplePack} />))

    expect(container.textContent).toContain("Bedrooms")
    expect(container.textContent).toContain("3 count")
    expect(container.textContent).toContain("TAPE MEASURE (high)")
    expect(container.textContent).toContain("Total floor area")
    expect(container.textContent).toContain("85 sqm")
  })

  it("renders requested scope items and highlights specialist inspection requirement", () => {
    act(() => root.render(<BuilderPackView pack={samplePack} />))

    expect(container.textContent).toContain("Roof Tile Replacement")
    expect(container.textContent).toContain("Masonry Repointing")
    expect(container.textContent).toContain("Specialist Inspection Needed")
    expect(container.textContent).toContain("Slipped tiles on rear slope")
  })

  it("renders assumptions, exclusions, and a blank contractor pricing schedule", () => {
    act(() => root.render(<BuilderPackView pack={samplePack} />))

    expect(container.textContent).toContain("Standard lime-mortar mix for external pointing.")
    expect(container.textContent).toContain("Internal decoration not included in building quote.")
    expect(container.textContent).toContain("Contractor Pricing Schedule (Blank)")
    expect(container.textContent).toContain("£ ____________")
    expect(container.textContent).toContain("____ days")
  })

  it("strictly excludes proprietary rates, margins, profit targets, or True MAO", () => {
    act(() => root.render(<BuilderPackView pack={samplePack} />))

    const html = container.innerHTML
    expect(html).not.toMatch(/true_?mao/i)
    expect(html).not.toMatch(/investor_?shield/i)
    expect(html).not.toMatch(/profit_?target/i)
    expect(html).not.toMatch(/day_?rate/i)
    expect(html).not.toMatch(/contractor_?margin/i)
  })
})
