import type { AdvisorySignalDisplay } from "@/types/investor-shield-ui"

type Props = {
  signal: AdvisorySignalDisplay
}

export default function InvestorShieldAdvisorySignal({ signal }: Props) {
  return (
    <article className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950">{signal.label}</p>
          <p className="text-xs uppercase tracking-wide text-blue-800">Advisory only</p>
        </div>
        <div className="text-right text-xs text-blue-800">
          <p>Source: {signal.source}</p>
          <p>Confidence: {signal.confidenceLabel}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-blue-950">
        <p className="font-medium">Cannot satisfy hard gates</p>
        <p className="text-xs text-blue-800">{signal.warningText}</p>
      </div>
    </article>
  )
}
