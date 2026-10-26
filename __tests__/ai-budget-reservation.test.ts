import { describe, expect, it } from "vitest"
import {
  BudgetReservationModel,
  ReservationStateError,
  claimDispatch,
  markDispatchUncertain,
  monthlyConsumptionMicros,
  createReservation,
  monthStartUtc,
  settleReservation,
  type ReservationRequest,
} from "@/lib/viewing-assessment/ai/budget-reservation"

const base: ReservationRequest = {
  reservationId: "res-1",
  runId: "run-1",
  attempt: 1,
  assessmentId: "assessment-1",
  provider: "claude",
  modelVersion: "claude-opus-5-5",
  reservedCostMicros: 1_000_000,
  createdAt: "2026-10-26T10:00:00.000Z",
  expiresAt: "2026-10-26T10:05:00.000Z",
}

const limits = { monthlyCeilingMicros: 2_000_000, perRunCeilingMicros: 1_500_000 }

describe("pure AI budget reservations", () => {
  it("assigns a stable UTC month and starts reserved", () => {
    expect(monthStartUtc("2026-10-26T10:00:00.000Z")).toBe("2026-10-01T00:00:00.000Z")
    expect(createReservation(base).state).toBe("RESERVED")
  })

  it("rejects invalid costs and missing approved limits", () => {
    expect(() => createReservation({ ...base, reservedCostMicros: -1 })).toThrow()
    expect(() => createReservation({ ...base, reservedCostMicros: 1.5 })).toThrow()
    expect(new BudgetReservationModel().reserve(base, { monthlyCeilingMicros: 0, perRunCeilingMicros: 1 })).toMatchObject({ ok: false })
  })

  it("admits one of two competing requests and makes duplicate identity idempotent", () => {
    const model = new BudgetReservationModel()
    expect(model.reserve(base, { ...limits, monthlyCeilingMicros: 1_500_000 })).toMatchObject({ ok: true, created: true })
    const constrained = { ...limits, monthlyCeilingMicros: 1_500_000 }
    expect(model.reserve({ ...base, reservationId: "res-duplicate" }, constrained)).toMatchObject({ ok: true, created: false })
    expect(model.reserve({ ...base, reservationId: "res-2", runId: "run-2" }, constrained)).toMatchObject({ ok: false, reason: "MONTHLY_LIMIT" })
  })

  it("settles known usage and releases only confirmed unused reserve", () => {
    const reservation = createReservation(base)
    const settled = settleReservation(reservation, { kind: "known", actualCostMicros: 400_000 })
    expect(settled.state).toBe("SETTLED")
    expect(settleReservation(reservation, { kind: "timeout" }).state).toBe("UNKNOWN")
    expect(() => settleReservation(settled, { kind: "known", actualCostMicros: 500_000 })).toThrow(ReservationStateError)
  })

  it("releases only the confirmed unused amount in the deterministic model", () => {
    const model = new BudgetReservationModel()
    const first = model.reserve(base, { ...limits, monthlyCeilingMicros: 1_500_000 })
    if (!first.ok) throw new Error("expected reservation")
    model.settle(first.reservation.reservationId, { kind: "known", actualCostMicros: 400_000 })
    expect(model.reserve({ ...base, reservationId: "res-2", runId: "run-2", reservedCostMicros: 1_100_000 }, { ...limits, monthlyCeilingMicros: 1_500_000 })).toMatchObject({ ok: true })
  })

  it("retains holds for timeout, unknown billing, expiry, and overage", () => {
    expect(settleReservation(createReservation(base), { kind: "timeout" }).state).toBe("UNKNOWN")
    expect(settleReservation(createReservation(base), { kind: "unknown" }).state).toBe("UNKNOWN")
    expect(settleReservation({ ...createReservation(base), expiresAt: "2026-10-25T00:00:00.000Z" }, { kind: "expired" }).state).toBe("EXPIRED")
    expect(() => settleReservation(createReservation(base), { kind: "known", actualCostMicros: 1_000_001 })).toThrow()
  })

  it("separates idempotent reservation retrieval from single-dispatch ownership", () => {
    const reservation = createReservation(base)
    const claimed = claimDispatch(reservation, "owner-a", "2026-10-26T10:01:00.000Z", "2026-10-26T10:02:00.000Z")
    expect(claimed.dispatchOwnerToken).toBe("owner-a")
    expect(claimDispatch(claimed, "owner-a", "2026-10-26T10:01:30.000Z", "2026-10-26T10:02:30.000Z")).toEqual(claimed)
    expect(() => claimDispatch(claimed, "owner-b", "2026-10-26T10:01:30.000Z", "2026-10-26T10:02:30.000Z")).toThrow(ReservationStateError)
    expect(markDispatchUncertain(claimed, "owner-a").dispatchState).toBe("UNKNOWN")
  })

  it("keeps an expired lease from granting a new dispatch owner", () => {
    const reservation = createReservation(base)
    const claimed = claimDispatch(reservation, "owner-a", "2026-10-26T10:01:00.000Z", "2026-10-26T10:02:00.000Z")
    expect(() => claimDispatch(claimed, "owner-b", "2026-10-26T10:03:00.000Z", "2026-10-26T10:04:00.000Z")).toThrow(ReservationStateError)
  })

  it("counts linked settled usage once and retains only active conservative holds", () => {
    const settled = settleReservation(createReservation(base), { kind: "known", actualCostMicros: 400_000 })
    const unknown = settleReservation(createReservation({ ...base, reservationId: "res-2", runId: "run-2" }), { kind: "unknown" })
    const released = settleReservation(createReservation({ ...base, reservationId: "res-3", runId: "run-3" }), { kind: "no_dispatch" })
    expect(monthlyConsumptionMicros(100_000, 400_000, [settled, unknown, released])).toBe(1_500_000)
  })

  it("releases only a proven no-dispatch reservation", () => {
    expect(settleReservation(createReservation(base), { kind: "no_dispatch" }).state).toBe("RELEASED")
    expect(() => settleReservation(createReservation(base), { kind: "no_dispatch" })).not.toThrow()
  })

  it("keeps the original month across rollover and separates attempts", () => {
    const model = new BudgetReservationModel()
    const first = model.reserve(base, limits)
    expect(first.ok && first.reservation.monthStart).toBe("2026-10-01T00:00:00.000Z")
    expect(model.reserve({ ...base, reservationId: "res-2", attempt: 2 }, { ...limits, monthlyCeilingMicros: 3_000_000 })).toMatchObject({ ok: true, created: true })
  })
})
