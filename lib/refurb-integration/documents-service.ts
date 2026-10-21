import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { BuilderQuotePack, DealPassport } from "@/types/deal-documents"
import { buildBuilderQuotePack } from "./builder-pack"
import { buildDealPassport } from "./deal-passport"
import { getFinancialState } from "./financial-proposal-service"
import { getMeasurementState } from "./measurement-service"
import { getProposalAndCurrent, type PlanDeps } from "./plan-service"

// Loads what the draft documents need and assembles them. Read-only.

export type DocumentDeps = PlanDeps & {
  /** The existing evidence-pack service (identity, investor summary, Investor Shield result, evidence index, disclaimers). */
  loadPack: (dealId: string, generatedAt: string) => Promise<PdfEvidencePack | null>
}

export type BuilderPackOutcome = { status: "not_found" } | { status: "no_plan" } | { status: "ok"; pack: BuilderQuotePack }

export async function loadBuilderPack(deps: PlanDeps, dealId: string, assessmentId: string): Promise<BuilderPackOutcome> {
  const base = await getProposalAndCurrent(deps, dealId, assessmentId)
  if (!base) return { status: "not_found" }
  const deal = await deps.getDeal(dealId)
  if (!deal) return { status: "not_found" }
  if (!base.current) return { status: "no_plan" }
  const measurementSet = base.current.record.measurementSetId ? await deps.measurements.getById(dealId, assessmentId, base.current.record.measurementSetId) : null
  return {
    status: "ok",
    pack: buildBuilderQuotePack({ generatedAt: deps.now().toISOString(), dealRef: { dealId, address: deal.address }, view: base.current, measurementSet }),
  }
}

export type PassportOutcome = { status: "not_found" } | { status: "ok"; passport: DealPassport }

export async function loadDealPassport(deps: DocumentDeps, dealId: string, assessmentId: string | null): Promise<PassportOutcome> {
  const deal = await deps.getDeal(dealId)
  if (!deal) return { status: "not_found" }
  const generatedAt = deps.now().toISOString()
  const pack = await deps.loadPack(dealId, generatedAt)
  if (!pack) return { status: "not_found" }

  let inspection = null
  let plan = null
  let history: Awaited<ReturnType<PlanDeps["plans"]["list"]>> = []
  let measurements = null
  let financial = null
  if (assessmentId) {
    const base = await getProposalAndCurrent(deps, dealId, assessmentId)
    if (!base) return { status: "not_found" } // an assessment of another deal is not found here
    inspection = { detail: base.detail, proposal: base.proposal }
    plan = base.current
    history = await deps.plans.list(dealId, assessmentId)
    const m = await getMeasurementState(deps, dealId, assessmentId)
    measurements = m === "not_found" ? null : m
    const f = await getFinancialState(deps, dealId, assessmentId)
    financial = f === "not_found" ? null : f
  }
  return { status: "ok", passport: buildDealPassport({ generatedAt, pack, deal, inspection, plan, planHistory: history, measurements, financial }) }
}
