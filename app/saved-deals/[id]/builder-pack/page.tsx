import { notFound } from "next/navigation"
import BuilderPackView from "@/components/refurb-plan/BuilderPackView"
import { requireOperatorPage } from "@/lib/auth/require-operator-page"
import { loadBuilderPack } from "@/lib/refurb-integration/documents-service"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id?: string }>
  searchParams: Promise<{ assessmentId?: string }>
}

const ID = /^[A-Za-z0-9:_.-]{1,150}$/

// Draft Builder Quotation Request Pack (read-only). Same fail-closed operator guard as the API.
export default async function BuilderPackPage({ params, searchParams }: PageProps) {
  const dealId = (await params).id ?? ""
  const requested = (await searchParams).assessmentId
  await requireOperatorPage(`/saved-deals/${encodeURIComponent(dealId)}/builder-pack${requested ? `?assessmentId=${encodeURIComponent(requested)}` : ""}`, dealId)
  if (!ID.test(dealId) || (requested !== undefined && !ID.test(requested))) notFound()

  const deps = getRefurbDeps()
  let assessmentId: string | null = requested ?? null
  if (!assessmentId) {
    const all = await deps.viewing.listAssessments(dealId)
    assessmentId = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]?.id ?? null
  }
  if (!assessmentId) notFound()

  const outcome = await loadBuilderPack(deps, dealId, assessmentId)
  if (outcome.status === "not_found" || outcome.status === "no_plan") notFound()

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between text-xs text-slate-600 print:hidden">
          <a href={`/saved-deals/${encodeURIComponent(dealId)}/viewing?assessment=${encodeURIComponent(assessmentId)}`} className="font-medium text-slate-900 underline hover:text-slate-700">
            ← Back to Viewing Assessment
          </a>
          <a href={`/saved-deals/${encodeURIComponent(dealId)}/passport?assessmentId=${encodeURIComponent(assessmentId)}`} className="font-medium text-slate-900 underline hover:text-slate-700">
            View Deal Passport →
          </a>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <BuilderPackView pack={outcome.pack} />
        </div>
      </div>
    </main>
  )
}
