import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import type { InvestorSummaryTaskSummary } from "@/types/investor-summary"

function isActiveTaskStatus(status: string): boolean {
  return status !== "COMPLETE" && status !== "CANCELLED"
}

function mapTaskRecord(task: DealTaskRecord): InvestorSummaryTaskSummary {
  return {
    taskId: task.id,
    title: task.task_title,
    taskType: task.task_type as InvestorSummaryTaskSummary["taskType"],
    status: task.task_status as InvestorSummaryTaskSummary["status"],
    priority: task.priority as InvestorSummaryTaskSummary["priority"],
    dueDate: task.due_date,
    blockerReason: task.blocker_reason,
    createdAt: task.created_at,
    completedAt: task.completed_at,
  }
}

export function selectActiveInvestorSummaryTasks(
  tasks: readonly DealTaskRecord[]
): readonly InvestorSummaryTaskSummary[] {
  return tasks.filter((task) => isActiveTaskStatus(task.task_status)).map(mapTaskRecord)
}
