import {
  type InvestorDealSummaryAdvisoryItem,
  type InvestorDealSummaryEvidenceLiteRow,
  type InvestorDealSummaryField,
  type InvestorDealSummaryGateRow,
  type InvestorDealSummarySemanticTone,
  type InvestorDealSummaryUnsupportedValue,
  type InvestorDealSummaryViewModel,
} from "@/types/investor-deal-summary"

type Props = {
  viewModel: InvestorDealSummaryViewModel
}

function toneClasses(tone: InvestorDealSummarySemanticTone | undefined): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    case "blocked":
      return "border-red-200 bg-red-50 text-red-900"
    case "caution":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "informational":
      return "border-sky-200 bg-sky-50 text-sky-900"
    default:
      return "border-gray-200 bg-gray-50 text-gray-900"
  }
}

function SectionHeading({
  id,
  children,
}: {
  id: string
  children: string
}) {
  return (
    <h2 id={id} className="text-lg font-semibold text-gray-950">
      {children}
    </h2>
  )
}

function FieldCard({
  field,
  testId,
}: {
  field: InvestorDealSummaryField
  testId?: string
}) {
  return (
    <div data-testid={testId} className={`rounded-xl border px-4 py-3 ${toneClasses(field.tone)}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{field.label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{field.value}</p>
      {field.supportingText ? (
        <p className="mt-2 break-words text-xs opacity-90">{field.supportingText}</p>
      ) : null}
    </div>
  )
}

function UnsupportedValueCard({
  item,
  testId,
}: {
  item: InvestorDealSummaryUnsupportedValue
  testId?: string
}) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
      <p className="mt-2 text-sm font-semibold text-gray-950">{item.value}</p>
      <p className="mt-2 break-words text-sm text-gray-700">{item.reason}</p>
    </div>
  )
}

function GateCard({ row }: { row: InvestorDealSummaryGateRow }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-950">{row.label}</h3>
          <p className="mt-2 break-words text-sm text-gray-700">{row.helperText}</p>
        </div>
        <div
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.statusTone)}`}
        >
          {row.status}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Blocker state</dt>
          <dd
            className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(row.blockerTone)}`}
          >
            {row.blockerState}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Missing evidence</dt>
          <dd
            className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(row.missingEvidenceTone)}`}
          >
            {row.missingEvidenceState}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Evidence Lite references</dt>
          <dd className="mt-1 text-sm text-gray-800">{row.evidenceReferenceCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Latest reference update</dt>
          <dd className="mt-1 break-words text-sm text-gray-800">{row.latestReferenceUpdate}</dd>
        </div>
      </dl>
    </li>
  )
}

function AdvisoryCard({ item }: { item: InvestorDealSummaryAdvisoryItem }) {
  return (
    <li className={`rounded-2xl border p-4 ${toneClasses(item.tone)}`}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-80">{item.sourceLabel}</p>
      <h3 className="mt-1 text-base font-semibold">{item.label}</h3>
      <p className="mt-2 break-words text-sm">{item.message}</p>
    </li>
  )
}

function EvidenceLiteCard({ row }: { row: InvestorDealSummaryEvidenceLiteRow }) {
  return (
    <li
      data-testid={`investor-deal-summary-evidence-row-${row.evidenceId}`}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Evidence Lite</p>
          <h3 className="mt-1 text-base font-semibold text-gray-950">{row.evidenceType}</h3>
          <p className="mt-2 break-all text-xs text-gray-500">Evidence ID: {row.evidenceId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.statusTone)}`}
          >
            {row.status}
          </span>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.reviewedTone)}`}
          >
            {row.reviewedState}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Linked gate</dt>
          <dd className="mt-1 break-words text-sm text-gray-800">{row.linkedGate}</dd>
        </div>
        {row.relevantTimestamp ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Relevant timestamp</dt>
            <dd className="mt-1 break-words text-sm text-gray-800">{row.relevantTimestamp}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Note</p>
          <p className="mt-2 break-words text-sm text-gray-700">{row.note}</p>
        </div>
        {row.reviewerNote ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Reviewer note</p>
            <p className="mt-2 break-words text-sm text-gray-700">{row.reviewerNote}</p>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function RiskList({
  title,
  items,
  className,
}: {
  title: string
  items: readonly string[]
  className: string
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className={`rounded-2xl border p-4 text-sm ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function InvestorDealSummaryDocument({ viewModel }: Props) {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section
          aria-labelledby="investor-deal-summary-header"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p
                data-testid="summary-confidentiality-label"
                className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500"
              >
                {viewModel.header.confidentialityLabel}
              </p>
              <h1 id="investor-deal-summary-header" className="text-3xl font-bold text-gray-950">
                {viewModel.header.title}
              </h1>
              <p className="text-sm text-gray-600">{viewModel.header.purposeText}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">Generated</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">
                  {viewModel.header.generatedAt}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">Deal ID</dt>
                <dd className="mt-1 break-all text-sm font-medium text-gray-900">
                  {viewModel.header.dealId}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-gray-500">Property</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900">
                  {viewModel.header.propertyIdentity}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>{viewModel.header.nonRelianceNotice}</p>
          </div>
        </section>

        <section
          aria-labelledby="executive-decision-snapshot"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="executive-decision-snapshot">Executive decision snapshot</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {viewModel.executiveDecisionSnapshot.map((field) => (
              <FieldCard
                key={field.label}
                field={field}
                testId={`summary-executive-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="core-financial-position"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="core-financial-position">Core financial position</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {viewModel.coreFinancialPosition.map((field) => (
              <FieldCard
                key={field.label}
                field={field}
                testId={`summary-financial-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="true-mao" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="true-mao">True MAO</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {viewModel.trueMao.bands.map((field) => (
              <FieldCard
                key={field.label}
                field={field}
                testId={`summary-true-mao-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {viewModel.trueMao.note}
          </p>
        </section>

        <section aria-labelledby="offer-position" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="offer-position">Offer position</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldCard
              field={viewModel.offerPosition.latestRecordedOfferAmount}
              testId="summary-latest-offer-amount"
            />
            <FieldCard
              field={viewModel.offerPosition.latestRecordedOfferStatus}
              testId="summary-latest-offer-status"
            />
            {viewModel.offerPosition.unsupportedOfferValues.map((field) => (
              <FieldCard
                key={field.label}
                field={field}
                testId={`summary-offer-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
          {viewModel.offerPosition.latestRecordedOfferAmount.value === "Not available" ? (
            <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {viewModel.offerPosition.noOfferMessage}
            </p>
          ) : null}
          <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {viewModel.offerPosition.offerLadderNotice}
          </p>
        </section>

        <section
          aria-labelledby="unsupported-values"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="unsupported-values">Unsupported values</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {viewModel.unsupportedValues.map((item) => (
              <UnsupportedValueCard
                key={item.label}
                item={item}
                testId={`summary-unsupported-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="investor-shield" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="investor-shield">Investor Shield</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {viewModel.investorShield.summaryFields.map((field) => (
              <FieldCard
                key={field.label}
                field={field}
                testId={`summary-shield-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              />
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            {viewModel.investorShield.authorityNotice}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div data-testid="summary-shield-required-gates">
              <h3 className="text-sm font-semibold text-gray-950">Required hard gates</h3>
              <ul className="mt-3 space-y-4">
                {viewModel.investorShield.requiredHardGates.map((row) => (
                  <GateCard key={row.gateKey} row={row} />
                ))}
              </ul>
            </div>
            <div data-testid="summary-shield-advisory-gates">
              <h3 className="text-sm font-semibold text-gray-950">Advisory gates</h3>
              {viewModel.investorShield.advisoryGates.length === 0 ? (
                <p className="mt-3 text-sm text-gray-700">
                  No advisory or caution items are currently recorded.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {viewModel.investorShield.advisoryGates.map((item) => (
                    <AdvisoryCard key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="professional-readiness"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="professional-readiness">Professional readiness</SectionHeading>
          <div
            data-testid="summary-professional-readiness"
            className={`mt-4 rounded-2xl border p-4 ${toneClasses(viewModel.professionalReadiness.tone)}`}
          >
            <p className="text-xs uppercase tracking-wide opacity-80">Professional readiness</p>
            <p className="mt-1 text-sm font-semibold">
              {viewModel.professionalReadiness.displayLabel}
            </p>
            <p className="mt-2 break-words text-sm">{viewModel.professionalReadiness.supportingSummary}</p>
            <p className="mt-3 break-words text-sm">{viewModel.professionalReadiness.authorityNotice}</p>
          </div>
        </section>

        <section aria-labelledby="evidence-lite" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="evidence-lite">Evidence Lite</SectionHeading>
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            <p>{viewModel.evidenceLite.notice}</p>
          </div>
          {viewModel.evidenceLite.rows.length === 0 ? (
            <p className="mt-4 text-sm text-gray-700">{viewModel.evidenceLite.emptyText}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {viewModel.evidenceLite.rows.map((row) => (
                <EvidenceLiteCard key={row.evidenceId} row={row} />
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="risks-blockers-missing-evidence"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="risks-blockers-missing-evidence">
            Risks, blockers, and missing evidence
          </SectionHeading>
          <div className="mt-4 space-y-3">
            <RiskList
              title="Warnings"
              items={viewModel.risks.warnings}
              className="border-amber-200 bg-amber-50 text-amber-950"
            />
            <RiskList
              title="Blockers"
              items={viewModel.risks.blockers}
              className="border-red-200 bg-red-50 text-red-950"
            />
            <RiskList
              title="Missing evidence"
              items={viewModel.risks.missingEvidence}
              className="border-sky-200 bg-sky-50 text-sky-950"
            />
            <RiskList
              title="Unavailable fields"
              items={viewModel.risks.unavailableFields}
              className="border-gray-200 bg-gray-50 text-gray-700"
            />
          </div>
        </section>

        <section
          aria-labelledby="recommended-next-action"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <SectionHeading id="recommended-next-action">Recommended next action</SectionHeading>
          <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            {viewModel.recommendedNextAction.value}
          </p>
        </section>

        <section aria-labelledby="summary-footer" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="summary-footer">Footer</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Confidentiality</p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {viewModel.footer.confidentialityLabel}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Generated</p>
              <p className="mt-1 break-words text-sm font-medium text-gray-900">
                {viewModel.footer.generatedAt}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Deal ID</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">
                {viewModel.footer.dealId}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>{viewModel.footer.nonRelianceNotice}</p>
            <p>{viewModel.footer.currentStateNotice}</p>
            {viewModel.footer.notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
