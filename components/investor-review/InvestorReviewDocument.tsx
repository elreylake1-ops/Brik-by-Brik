import DealFormulationSection from "@/components/investor-review/DealFormulationSection"
import ProfessionalEvidenceGatewaySection from "@/components/investor-review/ProfessionalEvidenceGatewaySection"
import {
  INVESTOR_REVIEW_EMPTY_ADVISORY_LABEL,
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
  type InvestorReviewReadyViewModel,
  type InvestorReviewEvidenceLiteRow,
  type InvestorReviewField,
  type InvestorReviewGateRow,
  type InvestorReviewSemanticTone,
} from "@/lib/investor-review/investor-review-view-model"

type Props = {
  viewModel: InvestorReviewReadyViewModel
}

function toneClasses(tone: InvestorReviewSemanticTone | undefined): string {
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

function FieldCard({ field, testId }: { field: InvestorReviewField; testId?: string }) {
  return (
    <div data-testid={testId} className={`rounded-xl border px-4 py-3 ${toneClasses(field.tone)}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{field.label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{field.value}</p>
    </div>
  )
}

function GateCard({ row }: { row: InvestorReviewGateRow }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-950">{row.label}</h3>
          <p className="mt-2 break-words text-sm text-gray-700">{row.helperText}</p>
        </div>
        <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.statusTone)}`}>
          {row.status}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Blocker state</dt>
          <dd className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(row.blockerTone)}`}>
            {row.blockerState}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Missing evidence</dt>
          <dd className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(row.missingEvidenceTone)}`}>
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

function EvidenceRowCard({ row }: { row: InvestorReviewEvidenceLiteRow }) {
  const rowTestId = `investor-review-evidence-row-${row.evidenceId}`
  const evidenceSummary = row.evidenceSummary ?? row.note ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  const showLegacyNote = row.note !== null && row.note !== evidenceSummary
  const referenceLabel = row.referenceLabel ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  const recommendedNextAction = row.recommendedNextAction ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  const expiryOrUpdateDate = row.expiryOrUpdateDate ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  const source = row.source ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  const mobileCaptureNote = row.mobileCaptureNote ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL

  return (
    <li
      data-testid={rowTestId}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Evidence command</p>
          <h3 className="mt-1 text-base font-semibold text-gray-950">{row.title}</h3>
          <p className="mt-2 break-all text-xs text-gray-500">Evidence ID: {row.evidenceId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            data-testid={`${rowTestId}-status`}
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.statusTone)}`}
          >
            {row.status}
          </span>
          <span
            data-testid={`${rowTestId}-review-state`}
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(row.reviewedTone)}`}
          >
            {row.reviewedLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FieldCard
          testId={`${rowTestId}-field-evidence-type`}
          field={{ label: "Evidence type", value: row.evidenceType }}
        />
        <FieldCard
          testId={`${rowTestId}-field-related-hard-gates`}
          field={{ label: "Related hard gate(s)", value: row.linkedGate }}
        />
        <FieldCard
          testId={`${rowTestId}-field-linked-investor-shield-gate`}
          field={{ label: "Linked Investor Shield gate", value: row.linkedInvestorShieldGate }}
        />
        <FieldCard
          testId={`${rowTestId}-field-linked-professional-gate`}
          field={{ label: "Linked professional gate", value: row.linkedProfessionalGate }}
        />
        <FieldCard
          testId={`${rowTestId}-field-evidence-strength`}
          field={{
            label: "Evidence strength",
            value: row.evidenceStrength,
            tone: row.evidenceStrengthTone,
          }}
        />
        <FieldCard
          testId={`${rowTestId}-field-blocker-impact`}
          field={{
            label: "Blocker impact",
            value: row.blockerImpact,
            tone: row.blockerImpactTone,
          }}
        />
        <FieldCard
          testId={`${rowTestId}-field-relevant-timestamp`}
          field={{ label: "Relevant timestamp", value: row.relevantTimestamp }}
        />
        <FieldCard
          testId={`${rowTestId}-field-reference-label`}
          field={{ label: "Reference label", value: referenceLabel }}
        />
        <FieldCard
          testId={`${rowTestId}-field-expiry-or-update-date`}
          field={{ label: "Expiry / update date", value: expiryOrUpdateDate }}
        />
        <FieldCard
          testId={`${rowTestId}-field-source`}
          field={{ label: "Source", value: source }}
        />
        <FieldCard
          testId={`${rowTestId}-field-mobile-capture-note`}
          field={{ label: "Mobile capture note", value: mobileCaptureNote }}
        />
        <FieldCard
          testId={`${rowTestId}-field-recommended-next-action`}
          field={{ label: "Recommended next action", value: recommendedNextAction }}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div
          data-testid={`${rowTestId}-summary`}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-gray-500">Evidence summary</p>
          <p className="mt-2 break-words text-sm text-gray-700">{evidenceSummary}</p>
        </div>
        {showLegacyNote ? (
          <div
            data-testid={`${rowTestId}-note`}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Legacy note</p>
            <p className="mt-2 break-words text-sm text-gray-700">{row.note}</p>
          </div>
        ) : null}
        {row.reviewerNote ? (
          <div
            data-testid={`${rowTestId}-reviewer-note`}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">Reviewer note</p>
            <p className="mt-2 break-words text-sm text-gray-700">{row.reviewerNote}</p>
          </div>
        ) : null}
      </div>

      {row.clarificationNote ? (
        <p className="mt-4 break-words rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {row.clarificationNote}
        </p>
      ) : null}
    </li>
  )
}

export default function InvestorReviewDocument({ viewModel }: Props) {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section aria-labelledby="investor-review-header" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                {viewModel.header.confidentialityLabel}
              </p>
              <h1 id="investor-review-header" className="text-3xl font-bold text-gray-950">
                {viewModel.header.title}
              </h1>
              <p className="text-sm text-gray-600">{viewModel.header.reviewPurpose}</p>
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
            </dl>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {viewModel.header.notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="property-and-deal-overview" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="property-and-deal-overview">Property and deal overview</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FieldCard field={viewModel.overview.propertyIdentity} />
            <FieldCard field={viewModel.overview.classification} />
            <FieldCard field={viewModel.overview.governance} />
            <FieldCard field={viewModel.overview.capitalProtection} />
            <FieldCard field={viewModel.overview.pipeline} />
          </div>
        </section>

        <section aria-labelledby="investment-summary" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="investment-summary">Investment summary</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FieldCard field={viewModel.investmentSummary.purchasePrice} />
            <FieldCard field={viewModel.investmentSummary.gdvDownside} />
            <FieldCard field={viewModel.investmentSummary.gdvRealistic} />
            <FieldCard field={viewModel.investmentSummary.gdvStrong} />
            <FieldCard field={viewModel.investmentSummary.trueMao15} />
            <FieldCard field={viewModel.investmentSummary.trueMao20} />
            <FieldCard field={viewModel.investmentSummary.trueMao25} />
            <FieldCard field={viewModel.investmentSummary.latestOfferAmount} />
          </div>
        </section>

        <DealFormulationSection viewModel={viewModel.dealFormulation} />

        <section aria-labelledby="decision-and-capital-protection-status" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="decision-and-capital-protection-status">
            Decision and capital-protection status
          </SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FieldCard field={viewModel.decisionSummary.overallStatus} />
            <FieldCard field={viewModel.decisionSummary.progressionDecision} />
            <FieldCard field={viewModel.decisionSummary.canProgress} />
            <FieldCard field={viewModel.decisionSummary.missingEvidenceCount} />
            <FieldCard field={viewModel.decisionSummary.blockedGateCount} />
          </div>
          <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {viewModel.decisionSummary.explanation}
          </p>
        </section>

        <section aria-labelledby="required-hard-gates" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="required-hard-gates">Required hard gates</SectionHeading>
          <ul className="mt-4 space-y-4">
            {viewModel.requiredGateRows.map((row) => (
              <GateCard key={row.gateKey} row={row} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="advisory-and-caution-gates" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="advisory-and-caution-gates">Advisory and caution gates</SectionHeading>
          {viewModel.advisoryItems.length === 0 ? (
            <p className="mt-4 text-sm text-gray-700">{INVESTOR_REVIEW_EMPTY_ADVISORY_LABEL}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {viewModel.advisoryItems.map((item) => (
                <li key={item.id} className={`rounded-2xl border p-4 ${toneClasses(item.tone)}`}>
                  <p className="text-xs uppercase tracking-[0.18em] opacity-80">{item.sourceLabel}</p>
                  <h3 className="mt-1 text-base font-semibold">{item.label}</h3>
                  <p className="mt-2 break-words text-sm">{item.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ProfessionalEvidenceGatewaySection
          viewModel={viewModel.professionalEvidenceGateway}
        />

        <section aria-labelledby="evidence-lite-notes" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="evidence-lite-notes">Evidence Lite records</SectionHeading>
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            <p>{viewModel.evidenceLiteNotice}</p>
            <p className="sr-only">
              Evidence Lite is read-only evidence notes. It is informational only and does not
              satisfy, waive, approve, or override Investor Shield requirements.
            </p>
          </div>
          {viewModel.evidenceLiteRows.length === 0 ? (
            <p className="mt-4 text-sm text-gray-700">{viewModel.emptyEvidenceLiteText}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {viewModel.evidenceLiteRows.map((row) => (
                <EvidenceRowCard key={row.evidenceId} row={row} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="missing-evidence-and-blockers" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="missing-evidence-and-blockers">Missing evidence and blockers</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FieldCard field={viewModel.decisionSummary.missingEvidenceCount} />
            <FieldCard field={viewModel.decisionSummary.blockedGateCount} />
          </div>
          {viewModel.blockerRows.length > 0 ? (
            <ul className="mt-4 space-y-3" aria-label="Active blockers">
              {viewModel.blockerRows.map((row) => (
                <li key={row.gateKey} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950">
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="mt-2 break-words text-sm">{row.blockerReason}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {viewModel.followUpRequirements.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Follow-up requirements</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {viewModel.followUpRequirements.map((requirement) => (
                  <li key={requirement} className="break-words">
                    {requirement}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="tasks-and-offers" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="tasks-and-offers">Tasks and offers</SectionHeading>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">Tasks</h3>
              {viewModel.tasks.length === 0 ? (
                <p className="mt-3 text-sm text-gray-700">{viewModel.emptyTasksText}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {viewModel.tasks.map((task) => (
                    <li key={task.taskId} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-950">{task.title}</p>
                      <p className="mt-1 break-all text-xs text-gray-500">Task ID: {task.taskId}</p>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500">Task type</dt>
                          <dd className="mt-1 text-sm text-gray-800">{task.taskType}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
                          <dd className="mt-1 text-sm text-gray-800">{task.status}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500">Priority</dt>
                          <dd className="mt-1 text-sm text-gray-800">{task.priority}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-gray-500">Due date</dt>
                          <dd className="mt-1 text-sm text-gray-800">{task.dueDate}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 break-words text-sm text-gray-700">Blocker reason: {task.blockerReason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-950">Offers</h3>
              {viewModel.latestOffer === null ? (
                <p className="mt-3 text-sm text-gray-700">{viewModel.emptyOffersText}</p>
              ) : (
                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-lg font-semibold text-gray-950">{viewModel.latestOffer.amount}</p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Offer type</dt>
                      <dd className="mt-1 text-sm text-gray-800">{viewModel.latestOffer.offerType}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Offer status</dt>
                      <dd className="mt-1 text-sm text-gray-800">{viewModel.latestOffer.offerStatus}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Rationale</dt>
                      <dd className="mt-1 break-words text-sm text-gray-800">{viewModel.latestOffer.rationale}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Seller response</dt>
                      <dd className="mt-1 break-words text-sm text-gray-800">{viewModel.latestOffer.sellerResponse}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Created at</dt>
                      <dd className="mt-1 break-words text-sm text-gray-800">{viewModel.latestOffer.createdAt}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="recommended-next-action" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="recommended-next-action">Recommended next action</SectionHeading>
          <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            {viewModel.recommendedNextAction}
          </p>
        </section>

        <section aria-labelledby="investor-review-footer" className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading id="investor-review-footer">Footer</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Confidentiality</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{viewModel.footer.confidentialityLabel}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Generated</p>
              <p className="mt-1 break-words text-sm font-medium text-gray-900">{viewModel.footer.generatedAt}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Deal ID</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{viewModel.footer.dealId}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {viewModel.footer.notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-950">Canonical disclaimers</h3>
            <ul className="mt-3 space-y-3">
              {viewModel.footer.disclaimers.map((disclaimer) => (
                <li key={disclaimer.code} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-950">{disclaimer.title}</p>
                    {disclaimer.required ? (
                      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-900">
                        Required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 break-words text-sm text-gray-700">{disclaimer.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}
