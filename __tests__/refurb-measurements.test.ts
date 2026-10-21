import { describe, expect, it } from "vitest"
import { ENGINE_MEASUREMENT_KEYS, MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { basicsFromMeasurements, diffMeasurementSets, parseMeasurementRequest, validateMeasurementEntries } from "@/lib/refurb-integration/measurements"
import { MEASUREMENT_SOURCES, type MeasurementEntry } from "@/types/refurb-measurements"

const measured = (key: string, value: number | string, over: Record<string, unknown> = {}) => ({ key, value, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "", ...over })
const estimate = (key: string, value: number | string, over: Record<string, unknown> = {}) => ({ key, value, basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "From the listing", ...over })
const unknown = (key: string, over: Record<string, unknown> = {}) => ({ key, value: null, basis: "UNKNOWN", source: null, confidence: null, note: "Not yet visited", ...over })
const ok = (entries: unknown) => {
  const r = validateMeasurementEntries(entries)
  if (!r.ok) throw new Error(r.errors.join("; "))
  return r
}
const errorsOf = (entries: unknown) => {
  const r = validateMeasurementEntries(entries)
  return r.ok ? [] : r.errors
}

describe("measurement validation", () => {
  it("accepts measured, estimated and unknown values, and fixes the unit from the spec", () => {
    const r = ok([measured("bedrooms", 3), estimate("floorAreaSqm", 88), unknown("kitchenSize"), measured("bathrooms", 1)])
    expect(r.entries.map((e) => [e.key, e.basis, e.unit])).toEqual([["bedrooms", "MEASURED", "count"], ["floorAreaSqm", "OPERATOR_ESTIMATE", "sqm"], ["kitchenSize", "UNKNOWN", "category"], ["bathrooms", "MEASURED", "count"]])
    expect(r.warnings.map((w) => w.code)).toContain("ESTIMATED_ENGINE_QUANTITY")
  })

  it("never accepts a video-derived source, a frame reference or an unknown field", () => {
    expect(MEASUREMENT_SOURCES).not.toContain("VIDEO" as never)
    expect(errorsOf([estimate("floorAreaSqm", 80, { source: "VIDEO_FRAME" })]).join(" ")).toMatch(/source must be one of/)
    expect(errorsOf([estimate("floorAreaSqm", 80, { source: "VIDEO" })]).join(" ")).toMatch(/source must be one of/)
    expect(errorsOf([{ ...measured("floorAreaSqm", 80), frameIds: ["f1"] }]).join(" ")).toMatch(/unknown field frameIds/)
    expect(errorsOf([{ ...measured("floorAreaSqm", 80), evidenceId: "e1" }]).join(" ")).toMatch(/unknown field evidenceId/)
  })

  it.each([
    ["a measurement that does not exist", [measured("roofPitch", 30)], /unknown measurement/],
    ["a wrong unit", [measured("bedrooms", 3, { unit: "sqm" })], /unit must be count/],
    ["fractional bedrooms", [measured("bedrooms", 2.5)], /whole number/],
    ["negative floor area", [measured("floorAreaSqm", -5)], /outside the allowed range/],
    ["an absurd floor area", [measured("floorAreaSqm", 1e9)], /outside the allowed range/],
    ["NaN/Infinity", [measured("floorAreaSqm", Infinity)], /must be a number/],
    ["a number as text", [measured("floorAreaSqm", "80" as never)], /must be a number/],
    ["a bad kitchen size", [measured("kitchenSize", "huge")], /value must be one of small, medium, large/],
    ["a value on an UNKNOWN", [unknown("floorAreaSqm", { value: 80 })], /cannot carry a value/],
    ["an UNKNOWN without a reason", [unknown("floorAreaSqm", { note: "" })], /say why it is unknown/],
    ["no source", [measured("bedrooms", 3, { source: undefined })], /source must be one of/],
    ["no confidence", [measured("bedrooms", 3, { confidence: undefined })], /confidence must be/],
    ["an estimate with no explanation", [estimate("bedrooms", 3, { note: "" })], /explain the estimate/],
    ["a tape reading claimed as an estimate", [estimate("bedrooms", 3, { source: "TAPE_MEASURE" })], /tape or laser reading is a MEASURED value/],
    ["a listing figure claimed as measured", [measured("floorAreaSqm", 80, { source: "EPC_OR_LISTING" })], /MEASURED value must come from a tape, laser or scaled floor plan/],
    ["a room name on a whole-property quantity", [measured("bedrooms", 3, { room: "Hall" })], /whole property, not a room/],
    ["a room dimension with no room", [measured("room_length_m", 4)], /room name is required/],
    ["a malicious room name", [measured("room_length_m", 4, { room: "<script>alert(1)</script>" })], /room name is invalid/],
    ["a note with control characters", [measured("bedrooms", 3, { note: "a\u0000b" })], /control characters/],
    ["a very long note", [measured("bedrooms", 3, { note: "x".repeat(301) })], /longer than 300/],
  ])("rejects %s", (_n, entries, pattern) => {
    expect(errorsOf(entries).join(" | ")).toMatch(pattern)
  })

  it("flags unusual-but-possible values and accepts them only when the operator confirms them", () => {
    expect(errorsOf([measured("floorAreaSqm", 900)]).join(" ")).toMatch(/outside the usual range 20 to 600 sqm.*acknowledgedImplausible/)
    const r = ok([measured("floorAreaSqm", 900, { acknowledgedImplausible: true })])
    expect(r.warnings).toEqual([expect.objectContaining({ code: "IMPLAUSIBLE_ACKNOWLEDGED", key: "floorAreaSqm" })])
    expect(errorsOf([measured("bedrooms", 12)]).length).toBe(1)
    expect(errorsOf([measured("ceiling_height_m", 6.5)]).length).toBe(1)
  })

  it("rejects conflicting values for the same quantity, per room", () => {
    expect(errorsOf([measured("floorAreaSqm", 80), estimate("floorAreaSqm", 95)]).join(" ")).toMatch(/conflicting values for Total floor area/)
    expect(errorsOf([measured("room_length_m", 4, { room: "Kitchen" }), measured("room_length_m", 4.5, { room: "kitchen" })]).join(" ")).toMatch(/conflicting values for Room length \(kitchen\)/)
    expect(errorsOf([measured("room_length_m", 4, { room: "Kitchen" }), measured("room_length_m", 5, { room: "Lounge" })])).toEqual([])
  })

  it("rejects room dimensions that add up to more than the total floor area", () => {
    const entries = [measured("floorAreaSqm", 30), measured("room_length_m", 5, { room: "Lounge" }), measured("room_width_m", 4, { room: "Lounge" }), measured("room_length_m", 4, { room: "Kitchen" }), measured("room_width_m", 3, { room: "Kitchen" })]
    expect(errorsOf(entries).join(" ")).toMatch(/add up to 32 sqm, more than the total floor area of 30 sqm/)
    expect(errorsOf([...entries.slice(0, 3), measured("floorAreaSqm", 30)].filter((e, i, a) => a.findIndex((x) => x.key === e.key) === i))).toEqual([])
  })

  it("limits the number of entries and rejects non-lists", () => {
    expect(errorsOf("nope")).toEqual(["entries must be a list"])
    expect(errorsOf([])[0]).toMatch(/1 to 60/)
    expect(errorsOf(Array.from({ length: 61 }, () => measured("bedrooms", 3)))[0]).toMatch(/1 to 60/)
  })

  it("only four quantities are marked as engine inputs; everything else is record-only", () => {
    expect(ENGINE_MEASUREMENT_KEYS.sort()).toEqual(["bathrooms", "bedrooms", "floorAreaSqm", "kitchenSize"])
    for (const [k, s] of Object.entries(MEASUREMENT_SPEC)) if (!s.engine) expect(["room_length_m", "room_width_m", "ceiling_height_m", "window_count", "external_door_count", "roof_area_sqm", "external_wall_area_sqm"]).toContain(k)
  })
})

describe("request parsing", () => {
  const base = { idempotencyKey: "measure-key-0001", basedOnVersion: 0, entries: [measured("bedrooms", 3)] }
  it("accepts a first set and carries warnings through", () => {
    const r = parseMeasurementRequest({ ...base, entries: [estimate("bedrooms", 3)] })
    expect(r.ok && r.value.warnings.length).toBe(1)
  })
  it.each([
    ["not an object", "x", /JSON object/],
    ["an unknown field", { ...base, reviewerId: "x" }, /Unknown field: reviewerId/],
    ["a bad key", { ...base, idempotencyKey: "x" }, /idempotencyKey/],
    ["no basedOnVersion", { ...base, basedOnVersion: undefined }, /basedOnVersion/],
    ["a correction without a reason", { ...base, basedOnVersion: 1 }, /changeNote is required/],
    ["a correction with a trivial reason", { ...base, basedOnVersion: 1, changeNote: "x" }, /changeNote is required/],
  ])("rejects %s", (_n, body, pattern) => {
    const r = parseMeasurementRequest(body)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.join(" ")).toMatch(pattern)
  })
  it("accepts a correction that says what was wrong", () => {
    expect(parseMeasurementRequest({ ...base, basedOnVersion: 1, changeNote: "Re-measured with a laser" }).ok).toBe(true)
  })
})

describe("what may be handed to the existing engine", () => {
  const entries = (list: unknown[]) => ok(list).entries
  it("passes measured and estimated engine quantities, with how each is known", () => {
    const r = basicsFromMeasurements(entries([measured("bedrooms", 3), estimate("bathrooms", 1), measured("floorAreaSqm", 84.5), measured("kitchenSize", "large")]))
    expect(r.basics).toEqual({ bedrooms: 3, bathrooms: 1, floorAreaSqm: 84.5, kitchenSize: "large" })
    expect(r.blockedBy).toEqual([])
    expect(r.basisNotes.join(" | ")).toMatch(/Bedrooms: 3, measured \(tape measure, high confidence\)/)
    expect(r.basisNotes.join(" | ")).toMatch(/Bathrooms: 1, operator estimate \(epc or listing, medium confidence\)/)
    expect(r.unresolved).toEqual(["Bathrooms is an estimate (1), not a measurement."])
  })

  it("blocks costing when bedrooms or bathrooms are unknown or absent, and never fills them in", () => {
    expect(basicsFromMeasurements(entries([unknown("bedrooms"), measured("bathrooms", 1)]))).toMatchObject({ basics: null, blockedBy: ["BEDROOMS_UNKNOWN"] })
    expect(basicsFromMeasurements(entries([measured("bedrooms", 3)]))).toMatchObject({ basics: null, blockedBy: ["BATHROOMS_UNKNOWN"] })
    expect(basicsFromMeasurements(entries([measured("window_count", 6)]))).toMatchObject({ basics: null, blockedBy: ["BEDROOMS_UNKNOWN", "BATHROOMS_UNKNOWN"] })
  })

  it("leaves unknown floor area and kitchen size out, and says what that means", () => {
    const r = basicsFromMeasurements(entries([measured("bedrooms", 2), measured("bathrooms", 1), unknown("floorAreaSqm")]))
    expect(r.basics).toEqual({ bedrooms: 2, bathrooms: 1 })
    expect(r.unresolved.join(" ")).toMatch(/room-count basis/)
    expect(r.unresolved.join(" ")).toMatch(/Kitchen size is not recorded/)
  })

  it("never hands record-only measurements (room sizes, counts, areas) to the engine", () => {
    const r = basicsFromMeasurements(entries([measured("bedrooms", 2), measured("bathrooms", 1), measured("roof_area_sqm", 120), measured("window_count", 8), measured("room_length_m", 4, { room: "Lounge" })]))
    expect(Object.keys(r.basics!).sort()).toEqual(["bathrooms", "bedrooms"])
  })
})

describe("correction history", () => {
  const e = (list: unknown[]): MeasurementEntry[] => ok(list).entries
  it("lists exactly what changed between versions", () => {
    const v1 = e([measured("bedrooms", 3), estimate("floorAreaSqm", 80), unknown("kitchenSize")])
    const v2 = e([measured("bedrooms", 3), measured("floorAreaSqm", 84.5), measured("bathrooms", 1)])
    const changes = diffMeasurementSets(v1, v2)
    expect(changes.map((c) => [c.key, c.change])).toEqual([["floorAreaSqm", "CHANGED"], ["bathrooms", "ADDED"], ["kitchenSize", "REMOVED"]])
    expect(changes[0].from).toMatch(/80 sqm \[OPERATOR_ESTIMATE/)
    expect(changes[0].to).toMatch(/84.5 sqm \[MEASURED, TAPE_MEASURE, high\]/)
    expect(diffMeasurementSets(v2, v2)).toEqual([])
  })
})
