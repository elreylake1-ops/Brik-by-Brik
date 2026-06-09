import type { TaskRecommendationDisplay } from "@/types/investor-shield-ui"
import InvestorShieldTaskRecommendation from "@/components/InvestorShieldTaskRecommendation"

type Props = {
  tasks: readonly TaskRecommendationDisplay[]
}

export default function InvestorShieldTaskRecommendationList({ tasks }: Props) {
  if (tasks.length === 0) {
    return <p className="mt-2 text-sm text-gray-700">No task recommendations.</p>
  }

  return (
    <div className="mt-3 space-y-2">
      {tasks.map((task) => (
        <InvestorShieldTaskRecommendation key={task.taskKey} task={task} />
      ))}
    </div>
  )
}
