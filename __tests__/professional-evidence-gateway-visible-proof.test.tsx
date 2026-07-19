import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import ProfessionalEvidenceGatewayProofPanel from "@/components/professional-evidence-gateway/ProfessionalEvidenceGatewayProofPanel"
import {
  getProfessionalEvidenceGatewayProofFixture,
  professionalEvidenceGatewayProofEvidence,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-proof-fixture"

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
        deepFreeze(nested)
      }
    }
  }

  return value
}

function renderProofPanel(): string {
  const fixture = getProfessionalEvidenceGatewayProofFixture()

  return renderToStaticMarkup(
    <ProfessionalEvidenceGatewayProofPanel
      seededSavedDealId={fixture.seededSavedDealId}
      viewModel={fixture.viewModel}
      rightmoveRule={fixture.rightmoveRule}
      qualifyingRule={fixture.qualifyingRule}
      investorShieldUnchangedNotice={fixture.investorShieldUnchangedNotice}
    />
  )
}

describe("professional evidence gateway visible proof", () => {
  it("renders the read-only proof title and seeded deal identifier", () => {
    const html = renderProofPanel()

    expect(html).toContain("Professional Evidence Gateway Proof")
    expect(html).toContain("Read-only dev/demo proof")
    expect(html).toContain("seeded-phase-5a-4b-proof-deal")
  })

  it("renders solicitor title evidence and sold comparable evidence", () => {
    const html = renderProofPanel()

    expect(html).toContain("Seeded solicitor title evidence")
    expect(html).toContain("Solicitor Review")
    expect(html).toContain("SOLICITOR")
    expect(html).toContain("Seeded Rightmove sold comparable evidence")
    expect(html).toContain("Sold Comparable Review")
    expect(html).toContain("Seeded Land Registry sold comparable confirmation")
  })

  it("shows RIGHTMOVE_SOLD_DATA as visible but non-confirming by itself", () => {
    const fixture = getProfessionalEvidenceGatewayProofFixture()
    const rightmoveGate = fixture.viewModel.gates.find(
      (gate) => gate.reviewSource === "RIGHTMOVE_SOLD_DATA"
    )
    const html = renderProofPanel()

    expect(html).toContain("RIGHTMOVE_SOLD_DATA")
    expect(html).toContain(
      "RIGHTMOVE_SOLD_DATA is visible but non-confirming by itself."
    )
    expect(html).toContain(
      "RIGHTMOVE_SOLD_DATA remains visible sold-comparable / portal evidence and can support valuation, Market Value Position, negotiation context and operator review, but it does not professionally confirm SOLD_COMPARABLE_REVIEW by itself."
    )
    expect(rightmoveGate).toMatchObject({
      professionalGateArea: "SOLD_COMPARABLE_REVIEW",
      professionalGateStatus: "UNDER_REVIEW",
      professionalReadiness: "READY_FOR_REVIEW",
      professionalConfirmationSummary:
        "Professional confirmation requires explicit compatible qualifying source",
    })
  })

  it("renders qualifying source evidence as confirming where appropriate", () => {
    const fixture = getProfessionalEvidenceGatewayProofFixture()
    const confirmingSources = fixture.viewModel.gates
      .filter(
        (gate) =>
          gate.professionalGateArea === "SOLD_COMPARABLE_REVIEW" &&
          gate.professionalGateStatus === "CONFIRMED" &&
          gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
      )
      .map((gate) => gate.reviewSource)
    const html = renderProofPanel()

    expect(confirmingSources).toContain("LAND_REGISTRY")
    expect(confirmingSources).toContain("SURVEYOR")
    expect(html).toContain(
      "Qualifying confirmation for SOLD_COMPARABLE_REVIEW remains limited to SURVEYOR, SOLICITOR, and LAND_REGISTRY."
    )
    expect(html).toContain("Confirming")
  })

  it("renders the Investor Shield unchanged safety notice without unsafe action language", () => {
    const html = renderProofPanel()

    expect(html).toContain(
      "Investor Shield remains unchanged. This proof does not clear gates or mutate pipeline state."
    )
    expect(html).not.toMatch(/clear gates(?! or mutate pipeline state)/i)
    expect(html).not.toMatch(/mutate pipeline state(?!\.)/i)
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Waive gate")
    expect(html).not.toContain("Move Pipeline")
  })

  it("exposes no write or persistence function surface", () => {
    const fixtureSource = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-proof-fixture.ts"
      ),
      "utf8"
    )
    const panelSource = readFileSync(
      path.resolve(
        process.cwd(),
        "components/professional-evidence-gateway/ProfessionalEvidenceGatewayProofPanel.tsx"
      ),
      "utf8"
    )
    const combinedSource = `${fixtureSource}\n${panelSource}`

    expect(combinedSource).not.toMatch(
      /export\s+(async\s+)?function\s+(create|update|delete|insert|save|persist)/i
    )
    expect(combinedSource).not.toContain("@/lib/evidence-lite/evidence-lite-repository")
    expect(combinedSource).not.toContain("@/lib/db/")
    expect(combinedSource).not.toContain("query(")
    expect(combinedSource).not.toContain("INSERT INTO")
    expect(combinedSource).not.toContain("UPDATE ")
    expect(combinedSource).not.toContain("DELETE ")
  })

  it("does not mutate seeded input data", () => {
    const frozenEvidence = deepFreeze(
      professionalEvidenceGatewayProofEvidence.map((evidence) => ({ ...evidence }))
    )
    const before = JSON.stringify(frozenEvidence)
    const fixture = getProfessionalEvidenceGatewayProofFixture()

    expect(JSON.stringify(frozenEvidence)).toBe(before)
    expect(fixture.seededEvidence).not.toBe(professionalEvidenceGatewayProofEvidence)
    expect(fixture.viewModel.gates).toHaveLength(5)
  })
})
