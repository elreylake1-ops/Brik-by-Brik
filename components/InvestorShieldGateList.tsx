import type { InvestorShieldGateDisplay } from "@/types/investor-shield-ui"
import InvestorShieldGateRow from "@/components/InvestorShieldGateRow"

type Props = {
  gates: readonly InvestorShieldGateDisplay[]
}

export default function InvestorShieldGateList({ gates }: Props) {
  const orderedGates = [...gates].sort(
    (left, right) => left.displayPriority - right.displayPriority || left.label.localeCompare(right.label)
  )

  if (orderedGates.length === 0) {
    return <p className="mt-2 text-sm text-gray-700">No required gates to display.</p>
  }

  return (
    <div className="mt-3 space-y-2">
      {orderedGates.map((gate) => (
        <InvestorShieldGateRow key={gate.gateKey} gate={gate} />
      ))}
    </div>
  )
}
