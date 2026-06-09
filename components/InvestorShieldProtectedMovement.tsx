import type { ProtectedMovementDisplay } from "@/types/investor-shield-ui"

type Props = {
  movement: ProtectedMovementDisplay
}

function stateToneClasses(movement: ProtectedMovementDisplay): string {
  if (movement.pipelineMutationPrevented || !movement.movementAllowed) {
    return "border-red-200 bg-red-50"
  }

  return "border-green-200 bg-green-50"
}

export default function InvestorShieldProtectedMovement({ movement }: Props) {
  const blocked = movement.pipelineMutationPrevented || !movement.movementAllowed

  return (
    <article className={`rounded-lg border px-3 py-3 ${stateToneClasses(movement)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Protected Movement</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Read-only pipeline state</p>
        </div>
        <div className="text-right text-xs text-gray-700">
          <p>Movement allowed: {movement.movementAllowed ? "Yes" : "No"}</p>
          <p>Pipeline mutation prevented: {movement.pipelineMutationPrevented ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-gray-800">
        <p>Current pipeline state: {movement.currentPipelineState}</p>
        <p>Attempted pipeline state: {movement.attemptedPipelineState ?? "N/A"}</p>
        {movement.blockingGateKeys.length > 0 ? (
          <p>Blocking gate keys: {movement.blockingGateKeys.join(", ")}</p>
        ) : (
          <p>Blocking gate keys: None</p>
        )}
        {movement.blockedReason ? <p className="font-medium text-red-700">{movement.blockedReason}</p> : null}
        <p className={blocked ? "font-semibold text-red-700" : "font-medium text-green-700"}>
          {blocked
            ? "Protected movement blocked."
            : "Protected movement currently allowed based on available gate status."}
        </p>
        {blocked ? <p className="text-xs text-red-700">Pipeline state was not changed.</p> : null}
        {blocked ? (
          <p className="text-xs text-red-700">
            Resolve or validly waive required gates before progressing.
          </p>
        ) : null}
        <p className="text-xs text-gray-600">{movement.explanation}</p>
      </div>
    </article>
  )
}
