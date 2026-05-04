import type {
  Trade,
  GeneratedRefurbTask,
  RefurbTimeline,
  RefurbPhase,
  TradeSchedule,
} from "@/types/refurb"

// All timeline assumptions named here — nothing hidden in logic
const TIMELINE_CONFIG = {
  WORKING_DAYS_PER_WEEK: 5,
  CONTINGENCY_FACTOR: 1.2, // 20% schedule buffer for delays, drying time, sequencing gaps
  PHASE_LABELS: {
    1: "Strip & Structural",
    2: "First & Second Fix",
    3: "Finishing",
  },
} as const

// Assigns each trade to a phase.
// Phases run sequentially; trades within the same phase run in parallel.
// Phase 1 → demolition/structure must complete before services begin
// Phase 2 → services/plaster before finishing
// Phase 3 → decoration/tiling after plaster is dry
const TRADE_PHASE_MAP: Record<Trade, 1 | 2 | 3> = {
  roofer: 1,
  builder: 1,
  labourer: 1,
  waste_removal: 1,
  electrician: 2,
  plumber: 2,
  gas_engineer: 2,
  plasterer: 2,
  carpenter: 2,
  decorator: 3,
  tiler: 3,
}

export function calculateTimeline(tasks: GeneratedRefurbTask[]): RefurbTimeline {
  // Sum effective labour days per trade (labourDays × quantity = total days for that task)
  const tradeDays: Partial<Record<Trade, number>> = {}
  for (const task of tasks) {
    const effectiveDays = task.labourDays * task.quantity
    tradeDays[task.trade] = (tradeDays[task.trade] ?? 0) + effectiveDays
  }

  // Build trade schedule
  const tradeSchedule: TradeSchedule[] = (
    Object.entries(tradeDays) as [Trade, number][]
  ).map(([trade, totalLabourDays]) => ({
    trade,
    totalLabourDays,
    phase: TRADE_PHASE_MAP[trade],
  }))

  // Phase duration = max labour days among trades in that phase (parallel working)
  const phaseDays: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  for (const { totalLabourDays, phase } of tradeSchedule) {
    if (totalLabourDays > phaseDays[phase]) {
      phaseDays[phase] = totalLabourDays
    }
  }

  const phases: RefurbPhase[] = ([1, 2, 3] as const).map((phaseNum) => ({
    phase: phaseNum,
    label: TIMELINE_CONFIG.PHASE_LABELS[phaseNum],
    trades: tradeSchedule
      .filter((ts) => ts.phase === phaseNum)
      .map((ts) => ts.trade),
    workingDays: phaseDays[phaseNum],
  }))

  const totalWorkingDays = phases.reduce((sum, p) => sum + p.workingDays, 0)
  const totalWorkingDaysWithContingency = Math.ceil(
    totalWorkingDays * TIMELINE_CONFIG.CONTINGENCY_FACTOR
  )
  const totalCalendarWeeks = Math.ceil(
    totalWorkingDaysWithContingency / TIMELINE_CONFIG.WORKING_DAYS_PER_WEEK
  )

  const warnings = [...new Set(tasks.flatMap((t) => t.warnings))]

  return {
    totalCalendarWeeks,
    totalWorkingDays,
    totalWorkingDaysWithContingency,
    phases,
    tradeSchedule,
    contingencyFactor: TIMELINE_CONFIG.CONTINGENCY_FACTOR,
    assumptions: [
      "Phases run sequentially: Strip & Structural → First & Second Fix → Finishing",
      "Trades within the same phase work in parallel — phase duration = longest trade in that phase",
      `${(TIMELINE_CONFIG.CONTINGENCY_FACTOR - 1) * 100}% contingency buffer applied to account for delays, drying time, and sequencing gaps`,
      `${TIMELINE_CONFIG.WORKING_DAYS_PER_WEEK} working days per week assumed`,
    ],
    warnings,
  }
}
