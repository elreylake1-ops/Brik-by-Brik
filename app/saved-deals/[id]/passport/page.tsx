import { notFound } from "next/navigation"
import DealPassportView from "@/components/refurb-plan/DealPassportView"
import { requireOperatorPage } from "@/lib/auth/require-operator-page"
import { loadDealPassport } from "@/lib/refurb-integration/documents-service"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id?: string }>
  searchParams: Promise<{ assessmentId?: string }>
}

const ID = /^[A-Za-z0-9:_.-]{1,150}$/

// Draft Deal Passport (read-only). Same fail-closed operator guard as the API; assembles existing services' output.
export default async function DealPassportPage({ params, searchParams }: PageProps) {
  const dealId = (await params).id ?? ""
  const requested = (await searchParams).assessmentId
  await requireOperatorPage(`/saved-deals/${encodeURIComponent(dealId)}/passport${requested ? `?assessmentId=${encodeURIComponent(requested)}` : ""}`, dealId)
  if (!ID.test(dealId) || (requested !== undefined && !ID.test(requested))) notFound()

  const deps = getRefurbDeps()
  let assessmentId: string | null = requested ?? null
  if (!assessmentId) {
    const all = await deps.viewing.listAssessments(dealId)
    // most recent assessment of THIS deal, chosen explicitly (repository list order is not part of the contract)
    assessmentId = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]?.id ?? null
  }
  const outcome = await loadDealPassport(deps, dealId, assessmentId)
  if (outcome.status === "not_found") notFound()

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <a href={`/saved-deals/${encodeURIComponent(dealId)}/viewing${assessmentId ? `?assessment=${encodeURIComponent(assessmentId)}` : ""}`} className="font-medium text-slate-900 underline hover:text-slate-700">
            ← Back to Viewing Assessment
          </a>
          {assessmentId ? (
            <a href={`/saved-deals/${encodeURIComponent(dealId)}/builder-pack?assessmentId=${encodeURIComponent(assessmentId)}`} className="font-medium text-slate-900 underline hover:text-slate-700">
              View Builder Quotation Pack →
            </a>
          ) : null}
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <DealPassportView passport={outcome.passport} />
        </div>
      </div>
    </main>
  )
}
