import type { WaiverDisplay } from "@/types/investor-shield-ui"

type Props = {
  waiver: WaiverDisplay
}

export default function InvestorShieldWaiverDisplay({ waiver }: Props) {
  if (!waiver.isWaived) {
    return <p className="mt-2 text-sm text-gray-700">No waived gates recorded.</p>
  }

  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950">Waived gate</p>
          <p className="text-xs uppercase tracking-wide text-amber-800">Read-only waiver display</p>
        </div>
        <div className="text-right text-xs text-amber-800">
          <p>Waiver status: Active</p>
          <p>Waiver does not equal satisfied evidence.</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-amber-950">
        <p className="font-medium">Waiver reason: {waiver.reason ?? "No waiver reason recorded."}</p>
        {waiver.waivedBy ? <p className="text-xs text-amber-800">Waived by: {waiver.waivedBy}</p> : null}
        {waiver.waivedAt ? <p className="text-xs text-amber-800">Waived at: {waiver.waivedAt}</p> : null}
        {waiver.warningText ? <p className="text-xs text-amber-800">{waiver.warningText}</p> : null}
        <p className="text-xs text-amber-800">Review waiver reason before relying on progression.</p>
      </div>
    </article>
  )
}
