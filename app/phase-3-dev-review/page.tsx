import type { Metadata } from "next"
import InvestorReviewDocument from "@/components/investor-review/InvestorReviewDocument"
import type { Phase3MergedOrchestrationOutput, Phase3OrchestrationOutput } from "@/types/phase3-orchestration"
import { INVESTOR_REVIEW_CONFIDENTIALITY_LABEL } from "@/lib/investor-review/investor-review-view-model"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import {
  PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT,
  PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS,
} from "@/lib/fixtures/phase3-review-surface-fixtures"
import noDealWeakComparableMerged from "@/__tests__/fixtures/phase3-merged-orchestration/no-deal-with-weak-comparable-hints-merged.json"
import reviewRequiredLegalConflictMerged from "@/__tests__/fixtures/phase3-merged-orchestration/review-required-with-legal-conflict-hints-merged.json"
import cleanProceedOperatorNoteMerged from "@/__tests__/fixtures/phase3-merged-orchestration/clean-proceed-with-accepted-operator-note-merged.json"
import intakeMissingLenderMerged from "@/__tests__/fixtures/phase3-merged-orchestration/intake-with-missing-lender-hints-merged.json"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "@/__tests__/fixtures/pdf-evidence-pack-fixtures"
import valuationReviewGapOutput from "@/__tests__/fixtures/phase3-orchestration/valuation-review-gap.json"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"

export const metadata: Metadata = {
  title: "Phase 3 Developer Review - Advisory Fixtures",
  description: "Developer-only fixture review surface for Phase 3 advisory merged outputs.",
}

type ScenarioEntry = {
  label: string
  output: Phase3MergedOrchestrationOutput
}

type AdditionalDealEntry = {
  label: string
  output: Phase3OrchestrationOutput
}

const FIXTURE_BY_ID: Record<string, Phase3MergedOrchestrationOutput> = {
  no_deal_with_weak_comparable_hints:
    noDealWeakComparableMerged as Phase3MergedOrchestrationOutput,
  review_required_with_legal_conflict_hints:
    reviewRequiredLegalConflictMerged as Phase3MergedOrchestrationOutput,
  clean_proceed_with_accepted_operator_note:
    cleanProceedOperatorNoteMerged as Phase3MergedOrchestrationOutput,
  intake_with_missing_lender_hints:
    intakeMissingLenderMerged as Phase3MergedOrchestrationOutput,
}

const ADDITIONAL_DEMO_DEAL: AdditionalDealEntry = {
  label: "Valuation Review Gap",
  output: valuationReviewGapOutput as Phase3OrchestrationOutput,
}

const ADDITIONAL_DEMO_SAVED_DEAL: SavedDealRecord = {
  id: "deal-pdf-complete-001",
  created_at: "2026-06-14T10:30:00.000Z",
  updated_at: "2026-06-14T10:30:00.000Z",
  archived_at: null,
  address: "22 Lake View Road, Leeds",
  listing_url: null,
  purchase_price: 125000,
  gdv_realistic: 200000,
  refurb_cost: 25000,
  classification: "STRONG_DEAL",
  governance_state: "MANUAL_REVIEW_REQUIRED",
  capital_protection_state: "PROTECTED",
  pipeline_state: "UNDER_ANALYSIS",
  engine_result_json: {},
  risk_summary_json: {},
  next_action: "Review lender criteria and solicitor evidence",
}

const ADDITIONAL_DEMO_REVIEW_VIEW_MODEL = mapPdfEvidencePackToInvestorReview({
  pack: {
    ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE,
    meta: {
      ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta,
      confidentialityLabel: INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
    },
  },
  savedDeal: ADDITIONAL_DEMO_SAVED_DEAL,
})

function buildScenarioEntries(): ScenarioEntry[] {
  return PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS.map((pair) => ({
    label: pair.label,
    output: FIXTURE_BY_ID[pair.id],
  }))
}

export function Phase3DevReviewContent() {
  const scenarios = buildScenarioEntries()

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Developer Review Only
          </p>
          <h1 className="mt-2 text-2xl font-bold text-amber-900">Advisory Phase 3 Output</h1>
          <p className="mt-2 text-sm text-amber-900">
            This page is fixture-only and does not change calculator, governance, or Phase 2 review behavior.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Deterministic Source Of Truth</h2>
          <p className="mt-2 text-sm text-gray-700">
            Deterministic decision output remains the source of truth. Merged Phase 3 output shown here is advisory
            only. No approve workflow or send-offer workflow exists on this page.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Scenario List</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {scenarios.map((scenario) => (
              <li key={scenario.label}>{scenario.label}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-red-300 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-900">Capital Protection Dominance</h2>
          <p className="mt-2 text-sm text-red-900">
            Capital protection remains dominant. Evidence hints do not soften this outcome.
          </p>
        </section>

        {scenarios.map((scenario) => (
          <section key={scenario.label} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">{scenario.label}</h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">globalDealState</div>
                <div className="mt-1 font-semibold text-gray-900">{scenario.output.globalDealState}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">workflowState</div>
                <div className="mt-1 font-semibold text-gray-900">{scenario.output.workflowState}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">primaryEscalationRoute</div>
                <div className="mt-1 font-semibold text-gray-900">{scenario.output.primaryEscalationRoute}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">secondaryEscalationRoutes</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {scenario.output.secondaryEscalationRoutes.length > 0
                    ? scenario.output.secondaryEscalationRoutes.join(", ")
                    : "none"}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">task count</div>
                <div className="mt-1 font-semibold text-gray-900">{scenario.output.tasks.length}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">warning count</div>
                <div className="mt-1 font-semibold text-gray-900">{scenario.output.warnings.length}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">reviewRequired</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {String(scenario.output.metadata.reviewRequired)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">advisoryOnly</div>
                <div className="mt-1 font-semibold text-gray-900">{String(scenario.output.advisoryOnly)}</div>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Advisory Tasks</h4>
              <div className="mt-3 grid gap-3">
                {scenario.output.tasks.map((task) => (
                  <div key={`${scenario.label}-${task.id}`} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-semibold text-gray-900">{task.title}</p>
                    <p className="mt-2 text-gray-700">
                      source: {task.source} | category: {task.category} | priority: {task.priority}
                    </p>
                    <p className="text-gray-700">
                      escalationRoute: {task.escalationRoute} | advisoryOnly: {String(task.advisoryOnly)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Warnings And Guardrails</h4>
              {scenario.output.warnings.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {scenario.output.warnings.map((warning) => (
                    <li key={`${scenario.label}-${warning.id}`}>{warning.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-600">No warnings in this fixture.</p>
              )}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                <li>no automated actions</li>
                <li>no AI extraction</li>
                <li>no scraping/integration data</li>
                <li>no persistence</li>
                <li>no final investment decision</li>
              </ul>
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 p-3 text-sm">
              <h4 className="font-semibold text-gray-900">Metadata / Debug</h4>
              <p className="mt-2 text-gray-700">
                deterministicTaskCount: {scenario.output.metadata.deterministicTaskCount}
              </p>
              <p className="text-gray-700">evidenceHintCount: {scenario.output.metadata.evidenceHintCount}</p>
              <p className="text-gray-700">mergedTaskCount: {scenario.output.metadata.mergedTaskCount}</p>
              <p className="text-gray-700">warningCount: {scenario.output.metadata.warningCount}</p>
              <p className="text-gray-700">metadata.advisoryOnly: {String(scenario.output.metadata.advisoryOnly)}</p>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Additional populated demo deal
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">{ADDITIONAL_DEMO_DEAL.label}</h2>
          <p className="mt-2 text-sm text-gray-700">
            Existing locked orchestration output surfaced as a separate read-only demo case.
          </p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">workflowState</div>
              <div className="mt-1 font-semibold text-gray-900">{ADDITIONAL_DEMO_DEAL.output.workflowState}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">globalDealState</div>
              <div className="mt-1 font-semibold text-gray-900">{ADDITIONAL_DEMO_DEAL.output.globalDealState}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">governanceEscalationRoute</div>
              <div className="mt-1 font-semibold text-gray-900">
                {ADDITIONAL_DEMO_DEAL.output.governanceEscalationRoute}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">evidence gap count</div>
              <div className="mt-1 font-semibold text-gray-900">{ADDITIONAL_DEMO_DEAL.output.metadata.evidenceGaps.length}</div>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Populated tasks</h3>
            <ul className="mt-3 grid gap-3">
              {ADDITIONAL_DEMO_DEAL.output.tasks.map((task) => (
                <li key={task.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <p className="font-semibold text-gray-900">{task.title}</p>
                  <p className="mt-1 text-gray-700">
                    route: {task.route} | status: {task.status} | blocksProgression: {String(task.blocksProgression)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Escalation reason: {ADDITIONAL_DEMO_DEAL.output.escalation.reason}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
          <p>
            Route contract: {PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.routeName} | mode:{" "}
            {PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.mode} | advisoryOnly:{" "}
            {String(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.advisoryOnly)}
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Additional populated demo / test deal
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">{ADDITIONAL_DEMO_DEAL.label}</h2>
          <p className="mt-2 text-sm text-gray-700">
            Existing locked orchestration output now sits beside a safe populated review document preview using the
            same read-only InvestorReviewDocument component as production.
          </p>
        </section>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <InvestorReviewDocument viewModel={ADDITIONAL_DEMO_REVIEW_VIEW_MODEL} />
        </div>
      </div>
    </main>
  )
}

export default function Phase3DevReviewPage() {
  return <Phase3DevReviewContent />
}
