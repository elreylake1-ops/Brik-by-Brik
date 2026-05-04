export type OverrideType =
  | "labour_day_rate"
  | "labour_days"
  | "material_price"
  | "task_include"
  | "task_exclude"

export type CostOverride = {
  id: string
  type: OverrideType
  targetTaskId?: string
  targetTrade?: string
  targetMaterialItem?: string
  value: number | boolean
  reason?: string
}

export type OverrideApplied = {
  overrideId: string
  type: OverrideType
  target: string
  previousValue: number | boolean | null
  newValue: number | boolean
  reason?: string
}

export type OverrideApplicationResult = {
  tasks: import("@/types/refurb").GeneratedRefurbTask[]
  applied: OverrideApplied[]
  warnings: string[]
  assumptions: string[]
}
