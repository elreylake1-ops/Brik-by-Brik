import type { TaskRecommendationDisplay } from "@/types/investor-shield-ui"

type Props = {
  task: TaskRecommendationDisplay
}

export default function InvestorShieldTaskRecommendation({ task }: Props) {
  return (
    <article className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950">{task.title}</p>
          <p className="text-xs uppercase tracking-wide text-blue-800">Recommended action</p>
        </div>
        <div className="text-right text-xs text-blue-800">
          <p>Status: {task.status}</p>
          <p>Duplicate-safe: {task.duplicateSafe ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-blue-950">
        <p>{task.description}</p>
        <p className="text-xs text-blue-800">Linked due diligence gate: {task.gateKey}</p>
        <p className="text-xs text-blue-800">Action type: {task.actionType}</p>
        <p className="text-xs text-blue-800">Duplicate-safe task recommendation</p>
        <p className="text-xs text-blue-800">This recommendation does not satisfy the gate by itself.</p>
      </div>
    </article>
  )
}
