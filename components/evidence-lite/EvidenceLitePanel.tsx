"use client"

import { useEffect, useState, type ReactNode } from "react"
import { formatLabel } from "@/lib/formatters"
import {
  EVIDENCE_COMMAND_BLOCKER_IMPACT_LABELS,
  EVIDENCE_COMMAND_BLOCKER_IMPACTS,
  EVIDENCE_COMMAND_DEFAULTS,
  EVIDENCE_COMMAND_PROFESSIONAL_GATE_LABELS,
  EVIDENCE_COMMAND_PROFESSIONAL_GATES,
  EVIDENCE_COMMAND_REVIEW_STATE_LABELS,
  EVIDENCE_COMMAND_REVIEW_STATES,
  EVIDENCE_COMMAND_STATUSES,
  EVIDENCE_COMMAND_STATUS_LABELS,
  EVIDENCE_COMMAND_STRENGTH_LABELS,
  EVIDENCE_COMMAND_STRENGTHS,
  EVIDENCE_COMMAND_TYPE_LABELS,
  EVIDENCE_COMMAND_TYPES,
  type EvidenceCommandBlockerImpact,
  type EvidenceCommandProfessionalGate,
  type EvidenceCommandReviewState,
  type EvidenceCommandStatus,
  type EvidenceCommandStrength,
  type EvidenceCommandType,
  type EvidenceLiteRecord,
} from "@/types/evidence-lite"
import {
  INVESTOR_SHIELD_GATE_KEYS,
  type InvestorShieldGateKey,
} from "@/types/investor-shield"

type Props = {
  savedDealId: string
  dealAddress?: string
}

type EvidenceLitePanelRecord = EvidenceLiteRecord & {
  linkedInvestorShieldGate?: InvestorShieldGateKey | null
  linkedProfessionalGate?: EvidenceCommandProfessionalGate | null
  evidenceCommandType?: EvidenceCommandType | null
  evidenceSummary?: string | null
  evidenceStatus?: EvidenceCommandStatus | null
  evidenceStrength?: EvidenceCommandStrength | null
  reviewState?: EvidenceCommandReviewState | null
  blockerImpact?: EvidenceCommandBlockerImpact | null
  recommendedNextAction?: string | null
  expiryOrUpdateDate?: string | null
  source?: string | null
  mobileCaptureNote?: string | null
}

type EvidenceLiteListResponse = {
  success?: boolean
  evidence?: EvidenceLitePanelRecord[]
  error?: string
  validation?: { errors?: Array<{ field: string; message: string }> }
}

type EvidenceLiteCreateResponse = {
  success?: boolean
  evidence?: EvidenceLitePanelRecord
  error?: string
  validation?: { errors?: Array<{ field: string; message: string }> }
}

type EvidenceCaptureFormState = {
  evidenceType: EvidenceCommandType
  linkedInvestorShieldGate: InvestorShieldGateKey
  linkedProfessionalGate: EvidenceCommandProfessionalGate
  title: string
  evidenceSummary: string
  evidenceStatus: EvidenceCommandStatus
  evidenceStrength: EvidenceCommandStrength
  reviewState: EvidenceCommandReviewState
  blockerImpact: EvidenceCommandBlockerImpact
  recommendedNextAction: string
  expiryOrUpdateDate: string
  source: string
  mobileCaptureNote: string
}

const CONTROL_CLASS_NAME =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"

const LEGACY_EVIDENCE_TYPE_LABELS: Record<string, string> = {
  SOLD_COMP: "Sold comparable",
  TITLE_REVIEW: "Title review",
  LEASEHOLD_REVIEW: "Leasehold review",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB_NOTE: "Refurb note",
  BUILDER_QUOTE: "Builder quote",
  SURVEY_NOTE: "Survey note",
  LENDER_NOTE: "Lender note",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor review",
  OTHER: "Other",
}

const INVESTOR_SHIELD_GATE_LABELS: Record<InvestorShieldGateKey, string> = {
  SOLD_COMPS: "Sold comparables",
  TITLE: "Title",
  LEASEHOLD: "Leasehold",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB_CERTAINTY: "Refurb certainty",
  BUILDER_PROPOSAL_CONTRACT: "Builder proposal / contract",
  DAMP_STRUCTURAL: "Damp / structural",
  LENDER_CRITERIA: "Lender criteria",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor review",
}

const FORM_FIELD_ORDER = [
  "evidenceType",
  "linkedInvestorShieldGate",
  "linkedProfessionalGate",
  "title",
  "evidenceSummary",
  "evidenceStatus",
  "evidenceStrength",
  "reviewState",
  "blockerImpact",
  "recommendedNextAction",
  "expiryOrUpdateDate",
  "source",
  "mobileCaptureNote",
] as const

function createInitialFormState(): EvidenceCaptureFormState {
  return {
    evidenceType: "TITLE_LEGAL",
    linkedInvestorShieldGate: "TITLE",
    linkedProfessionalGate: EVIDENCE_COMMAND_DEFAULTS.linkedProfessionalGate,
    title: "",
    evidenceSummary: "",
    evidenceStatus: EVIDENCE_COMMAND_DEFAULTS.evidenceStatus,
    evidenceStrength: EVIDENCE_COMMAND_DEFAULTS.evidenceStrength,
    reviewState: EVIDENCE_COMMAND_DEFAULTS.reviewState,
    blockerImpact: EVIDENCE_COMMAND_DEFAULTS.blockerImpact,
    recommendedNextAction: "",
    expiryOrUpdateDate: "",
    source: "",
    mobileCaptureNote: "",
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function buildRouteUrl(savedDealId: string): string {
  return `/api/saved-deals/${encodeURIComponent(savedDealId.trim())}/evidence`
}

function getLoadErrorMessage(): string {
  return "Evidence Command records could not be loaded right now. Investor Shield requirements are unchanged."
}

function getSubmitErrorMessage(): string {
  return "Evidence Command could not be saved right now. Investor Shield requirements are unchanged."
}

function buildValidationMessage(
  payload:
    | {
        error?: string
        validation?: { errors?: Array<{ field: string; message: string }> }
      }
    | null,
  fallback: string
): string {
  const validationMessage = payload?.validation?.errors?.find(
    (entry) => entry.message.trim().length > 0
  )?.message
  return validationMessage ?? payload?.error ?? fallback
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function labelForEvidenceType(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  if (Object.prototype.hasOwnProperty.call(EVIDENCE_COMMAND_TYPE_LABELS, value)) {
    return EVIDENCE_COMMAND_TYPE_LABELS[value as EvidenceCommandType]
  }

  if (Object.prototype.hasOwnProperty.call(LEGACY_EVIDENCE_TYPE_LABELS, value)) {
    return LEGACY_EVIDENCE_TYPE_LABELS[value]
  }

  return formatLabel(value)
}

function labelForInvestorShieldGate(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  return INVESTOR_SHIELD_GATE_LABELS[value as InvestorShieldGateKey] ?? formatLabel(value)
}

function labelForProfessionalGate(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  return (
    EVIDENCE_COMMAND_PROFESSIONAL_GATE_LABELS[value as EvidenceCommandProfessionalGate] ??
    formatLabel(value)
  )
}

function labelForStatus(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  return EVIDENCE_COMMAND_STATUS_LABELS[value as EvidenceCommandStatus] ?? formatLabel(value)
}

function labelForStrength(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  return EVIDENCE_COMMAND_STRENGTH_LABELS[value as EvidenceCommandStrength] ?? formatLabel(value)
}

function labelForReviewState(value?: string | null, reviewed?: boolean): string {
  if (value) {
    return EVIDENCE_COMMAND_REVIEW_STATE_LABELS[value as EvidenceCommandReviewState] ??
      formatLabel(value)
  }

  return reviewed ? "Reviewed" : "Not reviewed"
}

function labelForBlockerImpact(value?: string | null): string {
  if (!value) {
    return "Not provided"
  }

  return (
    EVIDENCE_COMMAND_BLOCKER_IMPACT_LABELS[value as EvidenceCommandBlockerImpact] ??
    formatLabel(value)
  )
}

function getStatusTone(value?: string | null): string {
  switch (value) {
    case "MISSING":
      return "border-amber-200 bg-amber-50 text-amber-950"
    case "REQUESTED":
      return "border-sky-200 bg-sky-50 text-sky-950"
    case "RECEIVED":
      return "border-cyan-200 bg-cyan-50 text-cyan-950"
    case "REVIEWED":
      return "border-slate-200 bg-slate-100 text-slate-950"
    case "SUFFICIENT":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    case "INSUFFICIENT":
      return "border-orange-200 bg-orange-50 text-orange-950"
    case "VERIFIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-950"
    case "EXPIRED":
      return "border-slate-200 bg-slate-50 text-slate-950"
    default:
      return "border-slate-200 bg-slate-50 text-slate-950"
  }
}

function getStrengthTone(value?: string | null): string {
  switch (value) {
    case "WEAK":
      return "border-amber-200 bg-amber-50 text-amber-950"
    case "MODERATE":
      return "border-sky-200 bg-sky-50 text-sky-950"
    case "STRONG":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    default:
      return "border-slate-200 bg-slate-50 text-slate-950"
  }
}

function getReviewTone(value?: string | null): string {
  switch (value) {
    case "REVIEWED_BY_OPERATOR":
      return "border-sky-200 bg-sky-50 text-sky-950"
    case "PROFESSIONAL_REVIEW_REQUIRED":
      return "border-amber-200 bg-amber-50 text-amber-950"
    case "PROFESSIONAL_CONFIRMED":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    default:
      return "border-slate-200 bg-slate-50 text-slate-950"
  }
}

function getImpactTone(value?: string | null): string {
  switch (value) {
    case "BLOCKS_PROGRESSION":
      return "border-rose-200 bg-rose-50 text-rose-950"
    case "CAUTION_ONLY":
      return "border-amber-200 bg-amber-50 text-amber-950"
    case "REQUIRES_MANUAL_REVIEW":
      return "border-indigo-200 bg-indigo-50 text-indigo-950"
    case "DOES_NOT_BLOCK":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    default:
      return "border-slate-200 bg-slate-50 text-slate-950"
  }
}

function FieldShell({
  id,
  label,
  testId,
  helpText,
  className = "",
  children,
}: {
  id: string
  label: string
  testId: string
  helpText?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div data-testid={testId} className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {children}
      {helpText ? <p className="text-xs leading-5 text-slate-500">{helpText}</p> : null}
    </div>
  )
}

function TextInputField({
  id,
  label,
  testId,
  value,
  onChange,
  placeholder,
  required = false,
  className = "",
  type = "text",
  helpText,
}: {
  id: string
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  type?: "text" | "date"
  helpText?: string
}) {
  return (
    <FieldShell id={id} label={label} testId={testId} helpText={helpText} className={className}>
      <input
        id={id}
        data-testid={`${testId}-control`}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={CONTROL_CLASS_NAME}
      />
    </FieldShell>
  )
}

function TextAreaField({
  id,
  label,
  testId,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  className = "",
  helpText,
}: {
  id: string
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  rows?: number
  className?: string
  helpText?: string
}) {
  return (
    <FieldShell id={id} label={label} testId={testId} helpText={helpText} className={className}>
      <textarea
        id={id}
        data-testid={`${testId}-control`}
        required={required}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${CONTROL_CLASS_NAME} min-h-24 resize-y`}
      />
    </FieldShell>
  )
}

function SelectField<T extends string>({
  id,
  label,
  testId,
  value,
  onChange,
  options,
  required = false,
  className = "",
  helpText,
}: {
  id: string
  label: string
  testId: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  required?: boolean
  className?: string
  helpText?: string
}) {
  return (
    <FieldShell id={id} label={label} testId={testId} helpText={helpText} className={className}>
      <select
        id={id}
        data-testid={`${testId}-control`}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={CONTROL_CLASS_NAME}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

function MetricCard({
  label,
  value,
  testId,
  toneClassName,
}: {
  label: string
  value: string
  testId: string
  toneClassName: string
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border px-3 py-2 shadow-sm ${toneClassName}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-5">{value}</div>
    </div>
  )
}

function DetailCard({
  label,
  value,
  testId,
  spanTwo = false,
}: {
  label: string
  value: string
  testId: string
  spanTwo?: boolean
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm ${
        spanTwo ? "sm:col-span-2" : ""
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm leading-5 text-slate-900">{value}</div>
    </div>
  )
}

export async function loadEvidenceLiteRecords(
  savedDealId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<EvidenceLitePanelRecord[]> {
  const response = await fetchImpl(buildRouteUrl(savedDealId), {
    headers: { accept: "application/json" },
  })

  const payload = await readJsonResponse<EvidenceLiteListResponse>(response)

  if (!response.ok || !payload?.success || !Array.isArray(payload.evidence)) {
    throw new Error(buildValidationMessage(payload, `Evidence Command load failed (${response.status})`))
  }

  return payload.evidence
}

async function createEvidenceLiteRecord(
  savedDealId: string,
  input: EvidenceCaptureFormState,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<EvidenceLitePanelRecord> {
  const response = await fetchImpl(buildRouteUrl(savedDealId), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      evidenceType: input.evidenceType,
      linkedInvestorShieldGate: input.linkedInvestorShieldGate,
      linkedProfessionalGate: input.linkedProfessionalGate,
      title: input.title.trim(),
      evidenceSummary: input.evidenceSummary.trim(),
      evidenceStatus: input.evidenceStatus,
      evidenceStrength: input.evidenceStrength,
      reviewState: input.reviewState,
      blockerImpact: input.blockerImpact,
      recommendedNextAction: normalizeOptionalText(input.recommendedNextAction),
      expiryOrUpdateDate: normalizeOptionalText(input.expiryOrUpdateDate),
      source: normalizeOptionalText(input.source),
      mobileCaptureNote: normalizeOptionalText(input.mobileCaptureNote),
    }),
  })

  const payload = await readJsonResponse<EvidenceLiteCreateResponse>(response)

  if (!response.ok || !payload?.success || !payload.evidence) {
    throw new Error(
      buildValidationMessage(payload, `Evidence Command create failed (${response.status})`)
    )
  }

  return payload.evidence
}

function formatDealReference(savedDealId: string, dealAddress?: string): string {
  return dealAddress
    ? `Saved deal: ${dealAddress} (${savedDealId})`
    : `Saved deal id: ${savedDealId}`
}

function formFieldLabel(value: (typeof FORM_FIELD_ORDER)[number]): string {
  switch (value) {
    case "evidenceType":
      return "Evidence type"
    case "linkedInvestorShieldGate":
      return "Linked Investor Shield gate"
    case "linkedProfessionalGate":
      return "Linked professional gate"
    case "title":
      return "Title"
    case "evidenceSummary":
      return "Evidence summary"
    case "evidenceStatus":
      return "Evidence status"
    case "evidenceStrength":
      return "Evidence strength"
    case "reviewState":
      return "Review state"
    case "blockerImpact":
      return "Blocker impact"
    case "recommendedNextAction":
      return "Recommended next action"
    case "expiryOrUpdateDate":
      return "Expiry / update date"
    case "source":
      return "Source"
    case "mobileCaptureNote":
      return "Mobile capture note"
  }
}

export default function EvidenceLitePanel({ savedDealId, dealAddress }: Props) {
  const [records, setRecords] = useState<EvidenceLitePanelRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<EvidenceCaptureFormState>(() => createInitialFormState())

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setLoadError(null)
      setSubmitError(null)
      setSubmitStatus(null)

      try {
        const evidence = await loadEvidenceLiteRecords(savedDealId)
        if (!cancelled) {
          setRecords(evidence)
        }
      } catch {
        if (!cancelled) {
          setLoadError(getLoadErrorMessage())
          setRecords([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [savedDealId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSubmitStatus(null)

    try {
      const created = await createEvidenceLiteRecord(savedDealId, form)
      setRecords((current) => [created, ...current.filter((record) => record.id !== created.id)])
      setForm(createInitialFormState())
      setSubmitStatus("Evidence Command saved and added to the panel.")
    } catch {
      setSubmitError(getSubmitErrorMessage())
    } finally {
      setSubmitting(false)
    }
  }

  const fieldCount = FORM_FIELD_ORDER.length

  return (
    <section
      aria-busy={loading || submitting}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"
      data-testid="evidence-command-panel"
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-950">
              Evidence Command
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              Capture structured evidence for review and follow-up in a phone-first panel.
            </p>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
            Evidence supports review but does not automatically satisfy Investor Shield hard gates,
            waive requirements, approve progression, or replace professional confirmation.
          </p>

          <p className="text-xs leading-5 text-slate-500">{formatDealReference(savedDealId, dealAddress)}</p>
        </div>

        <form
          aria-label="Evidence Command capture form"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4"
          onSubmit={handleSubmit}
          data-testid="evidence-command-form"
        >
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-slate-950">Capture evidence</h4>
            <p className="text-sm leading-6 text-slate-600">
              Structured fields stay readable on mobile and keep photo/video as selectable evidence
              types only. No uploads.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              id="evidence-type"
              label={formFieldLabel("evidenceType")}
              testId="evidence-field-evidence-type"
              value={form.evidenceType}
              onChange={(value) => setForm((current) => ({ ...current, evidenceType: value }))}
              required
              options={EVIDENCE_COMMAND_TYPES.map((value) => ({
                value,
                label: EVIDENCE_COMMAND_TYPE_LABELS[value],
              }))}
            />

            <SelectField
              id="linked-investor-shield-gate"
              label={formFieldLabel("linkedInvestorShieldGate")}
              testId="evidence-field-linked-investor-shield-gate"
              value={form.linkedInvestorShieldGate}
              onChange={(value) =>
                setForm((current) => ({ ...current, linkedInvestorShieldGate: value }))
              }
              required
              options={INVESTOR_SHIELD_GATE_KEYS.map((value) => ({
                value,
                label: labelForInvestorShieldGate(value),
              }))}
            />

            <SelectField
              id="linked-professional-gate"
              label={formFieldLabel("linkedProfessionalGate")}
              testId="evidence-field-linked-professional-gate"
              value={form.linkedProfessionalGate}
              onChange={(value) =>
                setForm((current) => ({ ...current, linkedProfessionalGate: value }))
              }
              options={EVIDENCE_COMMAND_PROFESSIONAL_GATES.map((value) => ({
                value,
                label: labelForProfessionalGate(value),
              }))}
            />

            <TextInputField
              id="title"
              label={formFieldLabel("title")}
              testId="evidence-field-title"
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
              required
              placeholder="Title pack, solicitor note, quote, or photo record"
              className="md:col-span-2"
            />

            <TextAreaField
              id="evidence-summary"
              label={formFieldLabel("evidenceSummary")}
              testId="evidence-field-evidence-summary"
              value={form.evidenceSummary}
              onChange={(value) => setForm((current) => ({ ...current, evidenceSummary: value }))}
              required
              rows={4}
              placeholder="Short factual summary of what the evidence shows."
              className="md:col-span-2"
            />

            <SelectField
              id="evidence-status"
              label={formFieldLabel("evidenceStatus")}
              testId="evidence-field-evidence-status"
              value={form.evidenceStatus}
              onChange={(value) => setForm((current) => ({ ...current, evidenceStatus: value }))}
              options={EVIDENCE_COMMAND_STATUSES.map((value) => ({
                value,
                label: labelForStatus(value),
              }))}
            />

            <SelectField
              id="evidence-strength"
              label={formFieldLabel("evidenceStrength")}
              testId="evidence-field-evidence-strength"
              value={form.evidenceStrength}
              onChange={(value) => setForm((current) => ({ ...current, evidenceStrength: value }))}
              options={EVIDENCE_COMMAND_STRENGTHS.map((value) => ({
                value,
                label: labelForStrength(value),
              }))}
            />

            <SelectField
              id="review-state"
              label={formFieldLabel("reviewState")}
              testId="evidence-field-review-state"
              value={form.reviewState}
              onChange={(value) => setForm((current) => ({ ...current, reviewState: value }))}
              options={EVIDENCE_COMMAND_REVIEW_STATES.map((value) => ({
                value,
                label: labelForReviewState(value),
              }))}
            />

            <SelectField
              id="blocker-impact"
              label={formFieldLabel("blockerImpact")}
              testId="evidence-field-blocker-impact"
              value={form.blockerImpact}
              onChange={(value) => setForm((current) => ({ ...current, blockerImpact: value }))}
              options={EVIDENCE_COMMAND_BLOCKER_IMPACTS.map((value) => ({
                value,
                label: labelForBlockerImpact(value),
              }))}
            />

            <TextInputField
              id="recommended-next-action"
              label={formFieldLabel("recommendedNextAction")}
              testId="evidence-field-recommended-next-action"
              value={form.recommendedNextAction}
              onChange={(value) =>
                setForm((current) => ({ ...current, recommendedNextAction: value }))
              }
              placeholder="Book review, request file, or follow up"
              className="md:col-span-2"
            />

            <TextInputField
              id="expiry-or-update-date"
              label={formFieldLabel("expiryOrUpdateDate")}
              testId="evidence-field-expiry-update-date"
              value={form.expiryOrUpdateDate}
              onChange={(value) => setForm((current) => ({ ...current, expiryOrUpdateDate: value }))}
              type="date"
            />

            <TextInputField
              id="source"
              label={formFieldLabel("source")}
              testId="evidence-field-source"
              value={form.source}
              onChange={(value) => setForm((current) => ({ ...current, source: value }))}
              placeholder="Call, email, document, or site visit"
            />

            <TextAreaField
              id="mobile-capture-note"
              label={formFieldLabel("mobileCaptureNote")}
              testId="evidence-field-mobile-capture-note"
              value={form.mobileCaptureNote}
              onChange={(value) => setForm((current) => ({ ...current, mobileCaptureNote: value }))}
              rows={3}
              placeholder="Optional note captured on mobile."
              className="md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              {fieldCount} structured fields, no uploads, and no governance actions.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Saving..." : "Save evidence"}
            </button>
          </div>

          <div aria-live="polite" className="mt-3 min-h-5 text-sm">
            {submitStatus ? (
              <p className="text-emerald-700" role="status">
                {submitStatus}
              </p>
            ) : null}
            {submitError ? (
              <p className="text-rose-700" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-slate-950">Captured evidence</h4>
            <p className="text-sm leading-6 text-slate-600">
              Each record keeps the structured command fields visible for quick review.
            </p>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500" role="status">
              Loading evidence records...
            </p>
          ) : null}

          {loadError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {loadError}
            </p>
          ) : null}

          {!loading && !loadError && records.length === 0 ? (
            <div className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4">
              <p className="text-sm font-medium text-slate-900">No evidence captured yet.</p>
              <p className="text-sm leading-6 text-slate-600">
                Use the form above to add the first structured record for this deal.
              </p>
            </div>
          ) : null}

          {records.length > 0 ? (
            <div className="mt-3 space-y-3" data-testid="evidence-record-list">
              {records.map((record) => {
                const evidenceType = labelForEvidenceType(record.evidenceCommandType ?? record.evidenceType)
                const linkedGate = labelForInvestorShieldGate(
                  record.linkedInvestorShieldGate ?? record.linkedGate
                )
                const professionalGate = labelForProfessionalGate(record.linkedProfessionalGate)
                const status = labelForStatus(record.evidenceStatus ?? record.status)
                const strength = labelForStrength(record.evidenceStrength)
                const reviewState = labelForReviewState(record.reviewState, record.reviewed)
                const blockerImpact = labelForBlockerImpact(record.blockerImpact)
                const summary = record.evidenceSummary ?? record.note
                const recommendedNextAction =
                  record.recommendedNextAction && record.recommendedNextAction.trim().length > 0
                    ? record.recommendedNextAction.trim()
                    : null
                const expiryOrUpdateDate =
                  record.expiryOrUpdateDate && record.expiryOrUpdateDate.trim().length > 0
                    ? record.expiryOrUpdateDate.trim()
                    : null
                const source =
                  record.source && record.source.trim().length > 0 ? record.source.trim() : null
                const mobileCaptureNote =
                  record.mobileCaptureNote && record.mobileCaptureNote.trim().length > 0
                    ? record.mobileCaptureNote.trim()
                    : null
                const professionalGateAvailable =
                  record.linkedProfessionalGate !== undefined || record.evidenceCommandType !== undefined

                return (
                  <article
                    key={record.id}
                    data-testid={`evidence-record-${record.id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h5 className="text-sm font-semibold leading-5 text-slate-950">
                            {record.title}
                          </h5>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Evidence ID: {record.id}
                          </p>
                        </div>
                        <div className="text-xs leading-5 text-slate-500 sm:text-right">
                          <p className="font-medium text-slate-700">{status}</p>
                          <p>{record.reviewed ? "Reviewed locally" : "Not reviewed locally"}</p>
                          <p>
                            Created {formatTimestamp(record.createdAt)}
                            <span className="text-slate-300"> | </span>
                            Updated {formatTimestamp(record.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <DetailCard
                          label="Evidence type"
                          value={evidenceType}
                          testId={`evidence-record-type-${record.id}`}
                        />
                        <DetailCard
                          label="Linked Investor Shield gate"
                          value={linkedGate}
                          testId={`evidence-record-linked-gate-${record.id}`}
                        />
                        <DetailCard
                          label="Professional gate"
                          value={professionalGateAvailable ? professionalGate : "Not provided"}
                          testId={`evidence-record-professional-gate-${record.id}`}
                        />
                        <MetricCard
                          label="Status"
                          value={status}
                          testId={`evidence-record-status-${record.id}`}
                          toneClassName={getStatusTone(record.evidenceStatus ?? record.status)}
                        />
                        <MetricCard
                          label="Strength"
                          value={strength}
                          testId={`evidence-record-strength-${record.id}`}
                          toneClassName={getStrengthTone(record.evidenceStrength)}
                        />
                        <MetricCard
                          label="Review state"
                          value={reviewState}
                          testId={`evidence-record-review-state-${record.id}`}
                          toneClassName={getReviewTone(record.reviewState)}
                        />
                        <MetricCard
                          label="Blocker impact"
                          value={blockerImpact}
                          testId={`evidence-record-blocker-impact-${record.id}`}
                          toneClassName={getImpactTone(record.blockerImpact)}
                        />
                        <DetailCard
                          label="Evidence summary"
                          value={summary}
                          testId={`evidence-record-summary-${record.id}`}
                          spanTwo
                        />
                        <DetailCard
                          label="Recommended next action"
                          value={recommendedNextAction ?? "Not provided"}
                          testId={`evidence-record-next-action-${record.id}`}
                          spanTwo
                        />
                        <DetailCard
                          label="Expiry / update date"
                          value={expiryOrUpdateDate ?? "Not provided"}
                          testId={`evidence-record-expiry-${record.id}`}
                        />
                        <DetailCard
                          label="Source"
                          value={source ?? "Not provided"}
                          testId={`evidence-record-source-${record.id}`}
                        />
                        <DetailCard
                          label="Mobile capture note"
                          value={mobileCaptureNote ?? "Not provided"}
                          testId={`evidence-record-mobile-note-${record.id}`}
                          spanTwo
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
