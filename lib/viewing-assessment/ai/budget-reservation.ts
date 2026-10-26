import { randomUUID } from "node:crypto"

export const RESERVATION_STATES = ["RESERVED", "SETTLED", "RELEASED", "UNKNOWN", "EXPIRED"] as const
export type ReservationState = typeof RESERVATION_STATES[number]

export type ReservationRequest = {
  reservationId?: string
  runId: string
  attempt: number
  assessmentId: string
  provider: "claude"
  modelVersion: string
  reservedCostMicros: number
  createdAt: string
  expiresAt: string
}

export type BudgetReservation = Omit<ReservationRequest, "reservationId"> & {
  reservationId: string
  monthStart: string
  actualCostMicros: number | null
  state: ReservationState
  settledAt: string | null
}

export type ApprovedBudgetLimits = { monthlyCeilingMicros: number; perRunCeilingMicros: number }
export type Settlement =
  | { kind: "known"; actualCostMicros: number }
  | { kind: "timeout" }
  | { kind: "unknown" }
  | { kind: "no_dispatch" }
  | { kind: "expired" }

export class ReservationStateError extends Error {}

const isSafeMicros = (value: number) => Number.isSafeInteger(value) && value >= 0

function requireSafeMicros(value: number, name: string): void {
  if (!isSafeMicros(value)) throw new RangeError(`${name} must be a non-negative safe integer`)
}

function requireLimits(limits: ApprovedBudgetLimits): void {
  if (!Number.isSafeInteger(limits.monthlyCeilingMicros) || limits.monthlyCeilingMicros <= 0) throw new RangeError("monthly budget ceiling is invalid")
  if (!Number.isSafeInteger(limits.perRunCeilingMicros) || limits.perRunCeilingMicros <= 0) throw new RangeError("per-run budget ceiling is invalid")
}

export function monthStartUtc(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.valueOf())) throw new RangeError("timestamp is invalid")
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString()
}

export function createReservation(input: ReservationRequest): BudgetReservation {
  if (!input.runId || !input.assessmentId || !input.modelVersion || input.attempt < 1 || !Number.isSafeInteger(input.attempt)) throw new RangeError("reservation identity is invalid")
  requireSafeMicros(input.reservedCostMicros, "reserved cost")
  const created = new Date(input.createdAt)
  const expiry = new Date(input.expiresAt)
  if (Number.isNaN(created.valueOf()) || Number.isNaN(expiry.valueOf()) || expiry <= created) throw new RangeError("reservation timestamps are invalid")
  return {
    ...input,
    reservationId: input.reservationId ?? randomUUID(),
    createdAt: created.toISOString(),
    expiresAt: expiry.toISOString(),
    monthStart: monthStartUtc(created.toISOString()),
    actualCostMicros: null,
    state: "RESERVED",
    settledAt: null,
  }
}

function sameSettlement(reservation: BudgetReservation, settlement: Settlement): boolean {
  if (settlement.kind === "known") return reservation.state === "SETTLED" && reservation.actualCostMicros === settlement.actualCostMicros
  if (settlement.kind === "timeout") return reservation.state === "SETTLED" && reservation.actualCostMicros === reservation.reservedCostMicros
  if (settlement.kind === "unknown") return reservation.state === "UNKNOWN"
  if (settlement.kind === "no_dispatch") return reservation.state === "RELEASED"
  return reservation.state === "EXPIRED"
}

export function settleReservation(reservation: BudgetReservation, settlement: Settlement, settledAt = reservation.createdAt): BudgetReservation {
  if (reservation.state !== "RESERVED") {
    if (sameSettlement(reservation, settlement)) return reservation
    throw new ReservationStateError("conflicting reservation settlement")
  }
  if (settlement.kind === "known") {
    requireSafeMicros(settlement.actualCostMicros, "actual cost")
    if (settlement.actualCostMicros > reservation.reservedCostMicros) throw new ReservationStateError("actual cost exceeds reserved cost")
    return { ...reservation, state: "SETTLED", actualCostMicros: settlement.actualCostMicros, settledAt }
  }
  if (settlement.kind === "timeout") return { ...reservation, state: "SETTLED", actualCostMicros: reservation.reservedCostMicros, settledAt }
  if (settlement.kind === "unknown") return { ...reservation, state: "UNKNOWN", settledAt }
  if (settlement.kind === "no_dispatch") return { ...reservation, state: "RELEASED", actualCostMicros: 0, settledAt }
  return { ...reservation, state: "EXPIRED", actualCostMicros: reservation.reservedCostMicros, settledAt }
}

export type ReserveResult =
  | { ok: true; created: boolean; reservation: BudgetReservation }
  | { ok: false; reason: "MONTHLY_LIMIT" | "PER_RUN_LIMIT" | "DUPLICATE_CONFLICT" }

/** Deterministic semantics model only; PostgreSQL locking still requires database-backed tests. */
export class BudgetReservationModel {
  private readonly reservations = new Map<string, BudgetReservation>()

  reserve(input: ReservationRequest, limits: ApprovedBudgetLimits): ReserveResult {
    try { requireLimits(limits) } catch { return { ok: false, reason: "MONTHLY_LIMIT" } }
    const candidate = createReservation(input)
    const key = `${candidate.runId}:${candidate.attempt}`
    const existing = [...this.reservations.values()].find((r) => `${r.runId}:${r.attempt}` === key)
    if (existing) return existing.assessmentId === candidate.assessmentId && existing.modelVersion === candidate.modelVersion
      ? { ok: true, created: false, reservation: existing }
      : { ok: false, reason: "DUPLICATE_CONFLICT" }
    if (candidate.reservedCostMicros > limits.perRunCeilingMicros) return { ok: false, reason: "PER_RUN_LIMIT" }
    const held = [...this.reservations.values()]
      .filter((r) => r.monthStart === candidate.monthStart)
      .reduce((sum, r) => sum + (r.state === "SETTLED" ? (r.actualCostMicros ?? r.reservedCostMicros) : r.state === "RELEASED" ? 0 : r.reservedCostMicros), 0)
    if (held > limits.monthlyCeilingMicros - candidate.reservedCostMicros) return { ok: false, reason: "MONTHLY_LIMIT" }
    this.reservations.set(candidate.reservationId, candidate)
    return { ok: true, created: true, reservation: candidate }
  }

  settle(reservationId: string, settlement: Settlement): BudgetReservation {
    const existing = this.reservations.get(reservationId)
    if (!existing) throw new ReservationStateError("reservation does not exist")
    const settled = settleReservation(existing, settlement)
    this.reservations.set(reservationId, settled)
    return settled
  }
}
