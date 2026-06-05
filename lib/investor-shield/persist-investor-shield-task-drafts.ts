import { createTask, listTasksForDeal } from "@/lib/operator-command/deal-tasks-repository"
import type { InvestorShieldTaskDraft } from "@/lib/investor-shield/build-investor-shield-task-drafts"

export type PersistInvestorShieldTaskDraftsResult = {
  insertedCount: number
  skippedDuplicateCount: number
  failedCount: number
  errors: string[]
}

const INVESTOR_SHIELD_MARKER_PREFIX = "Investor Shield ID:"

function buildBlockerReason(draft: InvestorShieldTaskDraft): string {
  return `${INVESTOR_SHIELD_MARKER_PREFIX} ${draft.idempotencyKey} | ${draft.description}`
}

function hasInvestorShieldDuplicate(
  draft: InvestorShieldTaskDraft,
  existingTasks: Awaited<ReturnType<typeof listTasksForDeal>>
): boolean {
  const marker = `${INVESTOR_SHIELD_MARKER_PREFIX} ${draft.idempotencyKey}`

  return existingTasks.some((task) => {
    const sameTitle = task.task_title === draft.title
    const sameMarker = typeof task.blocker_reason === "string" && task.blocker_reason.includes(marker)
    const openLikeStatus = task.task_status !== "COMPLETE" && task.task_status !== "CANCELLED"

    return openLikeStatus && (sameMarker || sameTitle)
  })
}

function dedupeDrafts(drafts: readonly InvestorShieldTaskDraft[]): InvestorShieldTaskDraft[] {
  const byKey = new Map<string, InvestorShieldTaskDraft>()

  for (const draft of drafts) {
    if (!byKey.has(draft.idempotencyKey)) {
      byKey.set(draft.idempotencyKey, draft)
    }
  }

  return [...byKey.values()]
}

export async function persistInvestorShieldTaskDrafts(
  dealId: string,
  drafts: readonly InvestorShieldTaskDraft[]
): Promise<PersistInvestorShieldTaskDraftsResult> {
  const uniqueDrafts = dedupeDrafts(drafts)

  if (uniqueDrafts.length === 0) {
    return {
      insertedCount: 0,
      skippedDuplicateCount: 0,
      failedCount: 0,
      errors: [],
    }
  }

  const existingTasks = await listTasksForDeal(dealId)

  let insertedCount = 0
  let skippedDuplicateCount = drafts.length - uniqueDrafts.length
  let failedCount = 0
  const errors: string[] = []

  for (const draft of uniqueDrafts) {
    if (hasInvestorShieldDuplicate(draft, existingTasks)) {
      skippedDuplicateCount += 1
      continue
    }

    try {
      await createTask(dealId, {
        task_title: draft.title,
        task_type: draft.taskType,
        task_status: draft.status,
        priority: draft.priority,
        blocker_reason: buildBlockerReason(draft),
      })

      insertedCount += 1
      existingTasks.unshift({
        id: `persisted:${draft.idempotencyKey}`,
        deal_id: dealId,
        task_title: draft.title,
        task_type: draft.taskType,
        task_status: draft.status,
        priority: draft.priority,
        due_date: null,
        blocker_reason: buildBlockerReason(draft),
        created_at: "",
        completed_at: null,
      })
    } catch (error) {
      failedCount += 1
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${draft.idempotencyKey}: ${message}`)
    }
  }

  return {
    insertedCount,
    skippedDuplicateCount,
    failedCount,
    errors,
  }
}
