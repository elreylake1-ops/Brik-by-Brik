import { query } from "@/lib/db/postgres"

const DEAL_TASK_FIELDS =
  "id, deal_id, task_title, task_type, task_status, priority, due_date, blocker_reason, created_at, completed_at"

export type DealTaskRecord = {
  id: string
  deal_id: string
  task_title: string
  task_type: string
  task_status: string
  priority: string
  due_date: string | null
  blocker_reason: string | null
  created_at: string
  completed_at: string | null
}

export type CreateTaskInput = {
  task_title: string
  task_type?: string
  task_status?: string
  priority?: string
  due_date?: string | null
  blocker_reason?: string | null
}

export async function createTask(dealId: string, input: CreateTaskInput): Promise<DealTaskRecord> {
  const result = await query<DealTaskRecord>(
    `INSERT INTO brik_by_brik_engine.deal_tasks (
      deal_id,
      task_title,
      task_type,
      task_status,
      priority,
      due_date,
      blocker_reason
    ) VALUES (
      $1,
      $2,
      COALESCE($3, 'DUE_DILIGENCE'),
      COALESCE($4, 'OPEN'),
      COALESCE($5, 'MEDIUM'),
      $6::date,
      $7
    ) RETURNING ${DEAL_TASK_FIELDS}`,
    [
      dealId,
      input.task_title,
      input.task_type ?? null,
      input.task_status ?? null,
      input.priority ?? null,
      input.due_date ?? null,
      input.blocker_reason ?? null,
    ]
  )

  return result.rows[0]
}

export async function listTasksForDeal(dealId: string): Promise<DealTaskRecord[]> {
  const result = await query<DealTaskRecord>(
    `SELECT ${DEAL_TASK_FIELDS}
     FROM brik_by_brik_engine.deal_tasks
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows
}

export async function updateTaskStatus(taskId: string, status: string): Promise<DealTaskRecord | null> {
  const result = await query<DealTaskRecord>(
    `UPDATE brik_by_brik_engine.deal_tasks
     SET task_status = $2
     WHERE id = $1
     RETURNING ${DEAL_TASK_FIELDS}`,
    [taskId, status]
  )

  return result.rows[0] ?? null
}

export async function markTaskBlocked(
  taskId: string,
  blockerReason: string | null
): Promise<DealTaskRecord | null> {
  const result = await query<DealTaskRecord>(
    `UPDATE brik_by_brik_engine.deal_tasks
     SET task_status = 'BLOCKED',
         blocker_reason = $2
     WHERE id = $1
     RETURNING ${DEAL_TASK_FIELDS}`,
    [taskId, blockerReason]
  )

  return result.rows[0] ?? null
}

export async function completeTask(taskId: string): Promise<DealTaskRecord | null> {
  const result = await query<DealTaskRecord>(
    `UPDATE brik_by_brik_engine.deal_tasks
     SET task_status = 'COMPLETE',
         completed_at = NOW()
     WHERE id = $1
     RETURNING ${DEAL_TASK_FIELDS}`,
    [taskId]
  )

  return result.rows[0] ?? null
}

