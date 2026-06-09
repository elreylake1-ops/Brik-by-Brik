import type { AdvisorySignalDisplay } from "@/types/investor-shield-ui"
import InvestorShieldAdvisorySignal from "@/components/InvestorShieldAdvisorySignal"

type Props = {
  signals: readonly AdvisorySignalDisplay[]
}

export default function InvestorShieldAdvisoryList({ signals }: Props) {
  if (signals.length === 0) {
    return <p className="mt-2 text-sm text-gray-700">No advisory signals to display.</p>
  }

  return (
    <div className="mt-3 space-y-2">
      {signals.map((signal) => (
        <InvestorShieldAdvisorySignal key={signal.signalKey} signal={signal} />
      ))}
    </div>
  )
}
