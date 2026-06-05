import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  BuilderContractCheck,
  BuilderProposal,
  EvidenceItem,
  InvestorShieldCheck,
  ManualOverride,
  RiskFlag,
} from "@/types/investor-shield"

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: queryMock,
}))

import {
  insertBuilderContractCheck,
  insertBuilderProposal,
  insertEvidenceItem,
  insertInvestorShieldChecks,
  insertManualOverride,
  insertRiskFlag,
  listBuilderContractChecksByDealId,
  listBuilderProposalsByDealId,
  listEvidenceItemsByDealId,
  listInvestorShieldChecksByDealId,
  listManualOverridesByDealId,
  listRiskFlagsByDealId,
} from "@/lib/investor-shield/investor-shield-repository"

const sampleCheck: InvestorShieldCheck = {
  dealId: "deal-1",
  gateKey: "SOLD_COMPS",
  status: "REQUIRED",
  severity: "BLOCKER",
  confidence: "LOW",
  requiredEvidence: ["SOLD_COMPARABLE"],
}

const sampleEvidenceItem: EvidenceItem = {
  dealId: "deal-1",
  gateKey: "REFURB_CERTAINTY",
  subGateKey: "MEDIA_EVIDENCE_PACK",
  evidenceType: "REFURB_PHOTO",
  source: "media",
  confidence: "MEDIUM",
  label: "Front elevation photo",
}

const sampleRiskFlag: RiskFlag = {
  dealId: "deal-1",
  gateKey: "DAMP_STRUCTURAL",
  severity: "BLOCKER",
  message: "Structural cracking requires review.",
  source: "professional",
}

const sampleManualOverride: ManualOverride = {
  dealId: "deal-1",
  gateKey: "SOLICITOR_FEEDBACK",
  reason: "Partner approved temporary waiver.",
}

const sampleBuilderProposal: BuilderProposal = {
  dealId: "deal-1",
  builderName: "Test Builder Ltd",
  quotedAmount: 22000,
  scopeSummary: "Light refurb",
  status: "IN_PROGRESS",
}

const sampleBuilderContractCheck: BuilderContractCheck = {
  dealId: "deal-1",
  builderProposalId: "proposal-1",
  status: "REQUIRED",
  hasSignedContract: true,
  hasPaymentSchedule: true,
  hasScopeOfWorks: true,
  hasStartDate: false,
  hasInsuranceEvidence: true,
}

describe("phase 4b investor shield repository", () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it("each list helper filters by deal_id in brik_by_brik_engine", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await listInvestorShieldChecksByDealId("deal-checks")
    await listEvidenceItemsByDealId("deal-evidence")
    await listRiskFlagsByDealId("deal-risks")
    await listManualOverridesByDealId("deal-overrides")
    await listBuilderProposalsByDealId("deal-proposals")
    await listBuilderContractChecksByDealId("deal-contracts")

    const expectedTables = [
      "investor_shield_checks",
      "evidence_items",
      "risk_flags",
      "manual_overrides",
      "builder_proposals",
      "builder_contract_checks",
    ]

    for (const [index, tableName] of expectedTables.entries()) {
      const [sql, params] = queryMock.mock.calls[index]
      expect(sql).toContain(`FROM brik_by_brik_engine.${tableName}`)
      expect(sql).toContain("WHERE deal_id = $1")
      expect(typeof params[0]).toBe("string")
      expect(sql).not.toContain("saved_deals")
    }
  })

  it("insertInvestorShieldChecks writes checks to the expected table with string deal ids", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "check-1",
          deal_id: "deal-1",
          gate_key: "SOLD_COMPS",
          sub_gate_key: null,
          status: "REQUIRED",
          severity: "BLOCKER",
          confidence: "LOW",
          required_evidence: ["SOLD_COMPARABLE"],
          summary: null,
          created_at: "2026-06-05",
          updated_at: "2026-06-05",
        },
      ],
    })

    const result = await insertInvestorShieldChecks([sampleCheck])

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("INSERT INTO brik_by_brik_engine.investor_shield_checks")
    expect(params[1]).toBe("deal-1")
    expect(typeof result[0].dealId).toBe("string")
  })

  it("insertEvidenceItem writes to evidence_items without touching saved_deals directly", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "evidence-1",
          deal_id: "deal-1",
          gate_key: "REFURB_CERTAINTY",
          sub_gate_key: "MEDIA_EVIDENCE_PACK",
          evidence_type: "REFURB_PHOTO",
          source: "media",
          label: "Front elevation photo",
          notes: null,
          file_url: null,
          advisory_only: false,
          created_at: "2026-06-05",
        },
      ],
    })

    const result = await insertEvidenceItem(sampleEvidenceItem)
    const [sql, params] = queryMock.mock.calls[0]

    expect(sql).toContain("INSERT INTO brik_by_brik_engine.evidence_items")
    expect(sql).not.toContain("saved_deals")
    expect(params[1]).toBe("deal-1")
    expect(result.confidence).toBe("MEDIUM")
  })

  it("insertRiskFlag writes to risk_flags", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "risk-1",
          deal_id: "deal-1",
          gate_key: "DAMP_STRUCTURAL",
          severity: "BLOCKER",
          message: "Structural cracking requires review.",
          source: "professional",
          created_at: "2026-06-05",
        },
      ],
    })

    await insertRiskFlag(sampleRiskFlag)
    const [sql, params] = queryMock.mock.calls[0]

    expect(sql).toContain("INSERT INTO brik_by_brik_engine.risk_flags")
    expect(params[1]).toBe("deal-1")
  })

  it("insertManualOverride writes to manual_overrides", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "override-1",
          deal_id: "deal-1",
          gate_key: "SOLICITOR_FEEDBACK",
          reason: "Partner approved temporary waiver.",
          approved_by: null,
          created_at: "2026-06-05",
        },
      ],
    })

    await insertManualOverride(sampleManualOverride)
    const [sql, params] = queryMock.mock.calls[0]

    expect(sql).toContain("INSERT INTO brik_by_brik_engine.manual_overrides")
    expect(params[1]).toBe("deal-1")
  })

  it("insertBuilderProposal writes to builder_proposals", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "proposal-1",
          deal_id: "deal-1",
          builder_name: "Test Builder Ltd",
          quoted_amount: 22000,
          scope_summary: "Light refurb",
          status: "IN_PROGRESS",
          created_at: "2026-06-05",
        },
      ],
    })

    await insertBuilderProposal(sampleBuilderProposal)
    const [sql, params] = queryMock.mock.calls[0]

    expect(sql).toContain("INSERT INTO brik_by_brik_engine.builder_proposals")
    expect(params[1]).toBe("deal-1")
  })

  it("insertBuilderContractCheck writes to builder_contract_checks", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "contract-1",
          deal_id: "deal-1",
          builder_proposal_id: "proposal-1",
          status: "REQUIRED",
          has_signed_contract: true,
          has_payment_schedule: true,
          has_scope_of_works: true,
          has_start_date: false,
          has_insurance_evidence: true,
          notes: null,
          created_at: "2026-06-05",
        },
      ],
    })

    await insertBuilderContractCheck(sampleBuilderContractCheck)
    const [sql, params] = queryMock.mock.calls[0]

    expect(sql).toContain("INSERT INTO brik_by_brik_engine.builder_contract_checks")
    expect(params[1]).toBe("deal-1")
  })

  it("repository remains isolated from saved deals wiring and default gate creation", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/investor-shield/investor-shield-repository.ts"),
      "utf8"
    )

    expect(source).not.toContain("@/lib/operator-command/saved-deals-repository")
    expect(source).not.toContain("@/lib/investor-shield/default-gates")
    expect(source).not.toContain("insert into brik_by_brik_engine.saved_deals")
    expect(source).not.toContain("createSavedDeal")
    expect(source).not.toContain("@/lib/engine")
    expect(source).not.toContain("@/app/")
  })
})
