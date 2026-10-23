import { notFound } from "next/navigation"
import RefurbPlanPanel from "@/components/refurb-plan/RefurbPlanPanel"
import ViewingAssessmentPanel from "@/components/viewing-assessment/ViewingAssessmentPanel"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { getFinancialState } from "@/lib/refurb-integration/financial-proposal-service"
import { getProposalAndCurrent } from "@/lib/refurb-integration/plan-service"
import { requireOperatorPage } from "@/lib/auth/require-operator-page"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { loadAssessmentDetail } from "@/lib/viewing-assessment/viewing-assessment-service"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id?: string }>
  searchParams: Promise<{ assessment?: string }>
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-amber-950">{title}</h1>
        <p className="mt-3 text-sm text-amber-950">{body}</p>
      </section>
    </main>
  )
}

export default async function ViewingAssessmentPage({ params, searchParams }: PageProps) {
  const dealId = (await params).id ?? ""
  const requestedAssessment = (await searchParams).assessment

  // Same fail-closed guard as the API: authenticate before touching any data (redirects to sign-in).
  await requireOperatorPage(`/saved-deals/${encodeURIComponent(dealId)}/viewing`, dealId)

  let deal: Awaited<ReturnType<typeof getSavedDealById>> = null
  let assessments: Awaited<ReturnType<typeof repo.listAssessments>>
  let detail: Awaited<ReturnType<typeof loadAssessmentDetail>> = null
  let refurb: Awaited<ReturnType<typeof getProposalAndCurrent>> = null
  let financial: Awaited<ReturnType<typeof getFinancialState>> = "not_found"
  try {
    deal = await getSavedDealById(dealId)
    if (!deal) notFound()
    assessments = await repo.listAssessments(dealId)
    const sorted = [...assessments].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    const selected = requestedAssessment ?? sorted[0]?.id
    detail = selected ? await loadAssessmentDetail(repo, dealId, selected) : null
    refurb = selected ? await getProposalAndCurrent(getRefurbDeps(), dealId, selected) : null
    financial = selected ? await getFinancialState(getRefurbDeps(), dealId, selected) : "not_found"
    const overrides = (selected && getRefurbDeps().quoteOverrides) ? await getRefurbDeps().quoteOverrides!.list(dealId, selected) : []
    var quoteOverrides = overrides.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      taskId: r.taskId,
      quoteRef: r.quoteRef,
      approvedAmount: r.approvedAmount,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      status: r.status,
      supersededBy: r.supersededBy,
      vatBasis: r.vatBasis,
      quoteType: r.quoteType,
      scopeVerified: r.scopeVerified,
      quoteEvidenceId: r.quoteEvidenceId,
    }))
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_")) throw error // notFound() etc.
    return <Notice title="Viewing assessment unavailable" body="The assessment data could not be loaded. Nothing has been changed." />
  }

  // All 58 checks are always listed, by id. Third-party checklist wording (title, group) is added only when its reuse
  // has been approved (server-side switch, default off); otherwise nothing but ids reaches the browser.
  const wordingApproved = process.env.VIEWING_CHECKLIST_WORDING_APPROVED === "true"
  const checks = VIEWING_CHECKLIST_V1.map((c) => (wordingApproved ? { id: c.id, title: c.title, group: c.group } : { id: c.id }))

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <a href={`/saved-deals/${encodeURIComponent(dealId)}/summary`} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                ← Saved Deal Summary
              </a>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Viewing Assessment</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{deal.address}</h1>
            <p className="text-xs text-slate-500">Deal Ref: {dealId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {detail ? (
              <>
                <a
                  href={`/saved-deals/${encodeURIComponent(dealId)}/builder-pack?assessmentId=${encodeURIComponent(detail.assessment.id)}`}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                >
                  Builder Pack (draft)
                </a>
                <a
                  href={`/saved-deals/${encodeURIComponent(dealId)}/passport?assessmentId=${encodeURIComponent(detail.assessment.id)}`}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                >
                  Deal Passport (draft)
                </a>
              </>
            ) : null}
          </div>
        </header>

        <ViewingAssessmentPanel dealId={dealId} assessments={assessments} detail={detail} checks={checks} />

        {detail && refurb && financial !== "not_found" ? (
          <RefurbPlanPanel
            dealId={dealId}
            assessmentId={detail.assessment.id}
            initial={{ proposal: refurb.proposal, current: refurb.current, measurements: refurb.latestMeasurements, financial, quoteOverrides }}
            spec={Object.entries(MEASUREMENT_SPEC).map(([key, v]) => ({ key, label: v.label, unit: v.unit, usedByEngine: v.engine, perRoom: Boolean(v.perRoom), values: v.values ?? null }))}
          />
        ) : null}
      </div>
    </main>
  )
}
