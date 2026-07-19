import type { Metadata } from "next"
import ProfessionalEvidenceGatewayProofPanel from "@/components/professional-evidence-gateway/ProfessionalEvidenceGatewayProofPanel"
import { getProfessionalEvidenceGatewayProofFixture } from "@/lib/professional-evidence-gateway/professional-evidence-gateway-proof-fixture"

export const metadata: Metadata = {
  title: "Professional Evidence Gateway Proof - Brik Engine v1",
  description:
    "Read-only dev/demo proof route for seeded Professional Evidence Gateway evidence.",
}

export default function Phase5AProfessionalGatewayProofPage() {
  const fixture = getProfessionalEvidenceGatewayProofFixture()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Read-only dev/demo proof
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Professional Evidence Gateway Proof
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Isolated Phase 5A-4B proof route using seeded evidence only. This page
            does not change Investor Shield authority, clear gates, mutate
            pipeline state, or write to persistence.
          </p>
        </section>

        <ProfessionalEvidenceGatewayProofPanel
          seededSavedDealId={fixture.seededSavedDealId}
          viewModel={fixture.viewModel}
          rightmoveRule={fixture.rightmoveRule}
          qualifyingRule={fixture.qualifyingRule}
          investorShieldUnchangedNotice={fixture.investorShieldUnchangedNotice}
        />
      </div>
    </main>
  )
}
