import { formatCurrency, formatLabel, formatPercent, formatProfit } from "@/lib/formatters"
import {
  INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
  type InvestorReviewSemanticTone,
} from "@/lib/investor-review/investor-review-view-model"
import type {
  DealFormulationMonetaryValue,
  DealFormulationViewModel,
} from "@/types/deal-formulation"

export type DealFormulationSectionProps = {
  viewModel: DealFormulationViewModel
}

const SECTION_SUBTITLE = "Canonical saved-deal financial position and decision support."
const AUTHORITY_NOTE =
  "Values shown here are read-only canonical outputs. Unsupported values remain unavailable and are not estimated."
const TRUE_MAO_NOTE =
  "No single investor-facing True MAO band has been selected in the current canonical model."
const OFFER_LADDER_NOTE = "No canonical monetary offer ladder currently exists."

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

function displayToken(value: string | null): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  if (!trimmed.includes("_")) {
    return trimmed
  }

  return formatLabel(trimmed.toLowerCase())
}

function moneyText(value: DealFormulationMonetaryValue): string {
  return value.amount === null ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL : formatCurrency(value.amount)
}

function monetarySupport(value: DealFormulationMonetaryValue): string | null {
  return value.amount === null ? value.unavailableReason : null
}

function verdictTone(value: string | null): InvestorReviewSemanticTone {
  const normalized = value?.trim().toUpperCase() ?? ""

  if (normalized === "GO") {
    return "success"
  }
  if (normalized === "CONDITIONAL") {
    return "caution"
  }
  if (normalized === "NO-GO") {
    return "blocked"
  }

  return "neutral"
}

function capitalProtectionTone(value: string | null): InvestorReviewSemanticTone {
  const normalized = value?.trim().toUpperCase() ?? ""

  if (normalized === "SAFE" || normalized === "PROTECTED") {
    return "success"
  }
  if (normalized === "CAUTION") {
    return "caution"
  }
  if (normalized === "HIGH_RISK" || normalized === "NO_DEAL") {
    return "blocked"
  }

  return "neutral"
}

function projectedProfitTone(value: DealFormulationMonetaryValue): InvestorReviewSemanticTone {
  if (value.amount === null) {
    return "neutral"
  }

  if (value.amount < 0) {
    return "blocked"
  }

  return "neutral"
}

function profitMarginTone(value: number | null): InvestorReviewSemanticTone {
  if (value === null) {
    return "neutral"
  }

  if (value < 0) {
    return "blocked"
  }

  return "neutral"
}

function FieldCard({
  label,
  value,
  supportingText,
  tone,
  testId,
}: {
  label: string
  value: string
  supportingText?: string | null
  tone?: InvestorReviewSemanticTone
  testId?: string
}) {
  return (
    <div data-testid={testId} className={`rounded-xl border px-4 py-3 ${toneClasses(tone)}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
      {supportingText ? (
        <p className="mt-2 break-words text-xs opacity-90">{supportingText}</p>
      ) : null}
    </div>
  )
}

export default function DealFormulationSection({
  viewModel,
}: DealFormulationSectionProps) {
  return (
    <section
      aria-labelledby="deal-formulation"
      className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-4">
        <div>
          <h2 id="deal-formulation" className="text-lg font-semibold text-gray-950">
            Deal Formulation
          </h2>
          <p className="mt-1 text-sm text-gray-600">{SECTION_SUBTITLE}</p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p>{AUTHORITY_NOTE}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-950">Financial summary</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldCard
              testId="deal-formulation-purchase-price"
              label="Purchase price"
              value={moneyText(viewModel.financialSummary.purchasePrice)}
              supportingText={monetarySupport(viewModel.financialSummary.purchasePrice)}
            />
            <FieldCard
              testId="deal-formulation-gdv-realistic"
              label="Realistic GDV"
              value={moneyText(viewModel.financialSummary.gdvRealistic)}
              supportingText={monetarySupport(viewModel.financialSummary.gdvRealistic)}
            />
            <FieldCard
              testId="deal-formulation-gdv-downside"
              label="Downside GDV"
              value={moneyText(viewModel.financialSummary.gdvDownside)}
              supportingText={monetarySupport(viewModel.financialSummary.gdvDownside)}
            />
            <FieldCard
              testId="deal-formulation-gdv-strong"
              label="Strong GDV"
              value={moneyText(viewModel.financialSummary.gdvStrong)}
              supportingText={monetarySupport(viewModel.financialSummary.gdvStrong)}
            />
            <FieldCard
              testId="deal-formulation-refurbishment-cost"
              label="Refurbishment cost"
              value={moneyText(viewModel.financialSummary.refurbishmentCost)}
              supportingText={monetarySupport(viewModel.financialSummary.refurbishmentCost)}
            />
            <FieldCard
              testId="deal-formulation-stamp-duty"
              label="Stamp duty"
              value={moneyText(viewModel.financialSummary.stampDuty)}
              supportingText={monetarySupport(viewModel.financialSummary.stampDuty)}
            />
            <FieldCard
              testId="deal-formulation-legal-costs"
              label="Legal costs"
              value={moneyText(viewModel.financialSummary.legalCosts)}
              supportingText={monetarySupport(viewModel.financialSummary.legalCosts)}
            />
            <FieldCard
              testId="deal-formulation-sale-costs"
              label="Sale costs"
              value={moneyText(viewModel.financialSummary.saleCosts)}
              supportingText={monetarySupport(viewModel.financialSummary.saleCosts)}
            />
            <FieldCard
              testId="deal-formulation-acquisition-costs"
              label="Acquisition costs"
              value={moneyText(viewModel.financialSummary.acquisitionCosts)}
              supportingText="No canonical acquisition-cost aggregate currently exists."
            />
            <FieldCard
              testId="deal-formulation-finance-cost"
              label="Finance cost"
              value={moneyText(viewModel.financialSummary.financeCost)}
              supportingText={monetarySupport(viewModel.financialSummary.financeCost)}
            />
            <FieldCard
              testId="deal-formulation-total-investment"
              label="Total investment"
              value={moneyText(viewModel.financialSummary.totalInvestment)}
              supportingText={monetarySupport(viewModel.financialSummary.totalInvestment)}
            />
            <FieldCard
              testId="deal-formulation-projected-profit"
              label="Projected profit"
              value={
                viewModel.financialSummary.projectedProfit.amount === null
                  ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
                  : formatProfit(viewModel.financialSummary.projectedProfit.amount)
              }
              supportingText={monetarySupport(viewModel.financialSummary.projectedProfit)}
              tone={projectedProfitTone(viewModel.financialSummary.projectedProfit)}
            />
            <FieldCard
              testId="deal-formulation-profit-margin"
              label="Profit margin"
              value={
                viewModel.financialSummary.profitMargin === null
                  ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
                  : formatPercent(viewModel.financialSummary.profitMargin)
              }
              supportingText={
                viewModel.financialSummary.profitMargin === null
                  ? "Profit margin unavailable."
                  : null
              }
              tone={profitMarginTone(viewModel.financialSummary.profitMargin)}
            />
            <FieldCard
              testId="deal-formulation-roi"
              label="ROI"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
              supportingText="ROI is not available from the current canonical engine output."
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-950">True MAO</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FieldCard
              testId="deal-formulation-true-mao-25"
              label="25% profit target"
              value={moneyText(viewModel.trueMao.twentyFivePercent)}
              supportingText={monetarySupport(viewModel.trueMao.twentyFivePercent)}
            />
            <FieldCard
              testId="deal-formulation-true-mao-20"
              label="20% profit target"
              value={moneyText(viewModel.trueMao.twentyPercent)}
              supportingText={monetarySupport(viewModel.trueMao.twentyPercent)}
            />
            <FieldCard
              testId="deal-formulation-true-mao-15"
              label="15% profit target"
              value={moneyText(viewModel.trueMao.fifteenPercent)}
              supportingText={monetarySupport(viewModel.trueMao.fifteenPercent)}
            />
          </div>
          <p className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {TRUE_MAO_NOTE}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-950">Offer position</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldCard
              testId="deal-formulation-latest-recorded-offer"
              label="Latest recorded offer"
              value={
                viewModel.offerPosition.latestRecordedOffer === null
                  ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
                  : formatCurrency(viewModel.offerPosition.latestRecordedOffer)
              }
            />
            <FieldCard
              testId="deal-formulation-latest-offer-status"
              label="Latest offer status"
              value={displayToken(viewModel.offerPosition.latestOfferStatus)}
            />
            <FieldCard
              testId="deal-formulation-opening-offer"
              label="Opening offer"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
            />
            <FieldCard
              testId="deal-formulation-target-offer"
              label="Target offer"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
            />
            <FieldCard
              testId="deal-formulation-final-offer"
              label="Final offer"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
            />
            <FieldCard
              testId="deal-formulation-walk-away-amount"
              label="Walk-away amount"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
            />
            <FieldCard
              testId="deal-formulation-walk-away-threshold"
              label="Walk-away threshold"
              value={INVESTOR_REVIEW_NOT_AVAILABLE_LABEL}
            />
          </div>
          {viewModel.offerPosition.latestRecordedOffer === null ? (
            <p className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {INVESTOR_REVIEW_EMPTY_OFFERS_LABEL}
            </p>
          ) : null}
          <p className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {OFFER_LADDER_NOTE}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-950">Decision outputs</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FieldCard
              testId="deal-formulation-verdict"
              label="Verdict"
              value={displayToken(viewModel.decision.verdictStatus)}
              tone={verdictTone(viewModel.decision.verdictStatus)}
            />
            <FieldCard
              testId="deal-formulation-classification"
              label="Persisted classification"
              value={displayToken(viewModel.decision.classification)}
            />
            <FieldCard
              testId="deal-formulation-capital-protection"
              label="Capital protection"
              value={displayToken(viewModel.decision.capitalProtectionState)}
              tone={capitalProtectionTone(viewModel.decision.capitalProtectionState)}
            />
            <FieldCard
              testId="deal-formulation-strategy"
              label="Strategy recommendation"
              value={displayToken(viewModel.decision.strategyRecommendation)}
            />
            <FieldCard
              testId="deal-formulation-recommended-next-action"
              label="Recommended next action"
              value={displayToken(viewModel.decision.recommendedNextAction)}
            />
          </div>
        </div>

        {viewModel.warnings.canonicalWarnings.length > 0 ||
        viewModel.warnings.unavailableFields.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-950">Warnings and unavailable values</h3>
            <div className="mt-3 space-y-3">
              {viewModel.warnings.canonicalWarnings.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="text-xs font-semibold uppercase tracking-wide">Canonical warnings</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {viewModel.warnings.canonicalWarnings.map((warning) => (
                      <li key={warning} className="break-words">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {viewModel.warnings.unavailableFields.length > 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Unsupported or unavailable values
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {viewModel.warnings.unavailableFields.map((warning) => (
                      <li key={warning} className="break-words">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
