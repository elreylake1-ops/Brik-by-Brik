import { MAX_MEASUREMENT_ENTRIES, MAX_NOTE_CHARS, MAX_ROOM_CHARS, MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import {
  MEASUREMENT_BASES,
  MEASUREMENT_CONFIDENCE,
  MEASUREMENT_SOURCES,
  type MeasurementBasics,
  type MeasurementBasis,
  type MeasurementChange,
  type MeasurementConfidence,
  type MeasurementEntry,
  type MeasurementSource,
  type MeasurementWarning,
} from "@/types/refurb-measurements"
import type { PropertyBasics } from "@/types/refurb-integration"
import type { KitchenSize } from "@/types/scope"
import type { Parsed } from "./plan-request-validation"

// Validation and interpretation of operator-entered measurements. Pure.
// There is no source called "video" and no field for a frame, so a measurement can never claim to come from footage.
// Nothing here prices anything: it only decides which entered quantities are fit to hand to the existing engine.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const ENTRY_KEYS = ["key", "room", "value", "unit", "basis", "source", "confidence", "note", "acknowledgedImplausible"]
const ROOM_PATTERN = /^[\p{L}\p{N} &'().,-]+$/u
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/
const MEASURED_SOURCES: readonly MeasurementSource[] = ["TAPE_MEASURE", "LASER_MEASURE", "FLOOR_PLAN"]

const roomKey = (e: Pick<MeasurementEntry, "key" | "room">) => `${e.key}|${(e.room ?? "").trim().toLowerCase()}`

export type ValidatedMeasurements = { ok: true; entries: MeasurementEntry[]; warnings: MeasurementWarning[] } | { ok: false; errors: string[] }

export function validateMeasurementEntries(raw: unknown): ValidatedMeasurements {
  if (!Array.isArray(raw)) return { ok: false, errors: ["entries must be a list"] }
  if (raw.length === 0 || raw.length > MAX_MEASUREMENT_ENTRIES) return { ok: false, errors: [`entries must contain 1 to ${MAX_MEASUREMENT_ENTRIES} items`] }
  const errors: string[] = []
  const warnings: MeasurementWarning[] = []
  const entries: MeasurementEntry[] = []

  raw.forEach((item, i) => {
    const at = `entries[${i}]`
    const startErrors = errors.length
    if (!isObject(item)) return void errors.push(`${at} must be an object`)
    for (const k of Object.keys(item)) if (!ENTRY_KEYS.includes(k)) errors.push(`${at}: unknown field ${k}`)
    const key = item.key
    const spec = typeof key === "string" ? MEASUREMENT_SPEC[key] : undefined
    if (typeof key !== "string" || !spec) return void errors.push(`${at}: unknown measurement ${String(key).slice(0, 40)}`)

    const label = spec.label
    if (item.unit !== undefined && item.unit !== spec.unit) errors.push(`${at} (${label}): unit must be ${spec.unit}`)

    let room: string | undefined
    if (item.room !== undefined) {
      if (typeof item.room !== "string" || item.room.trim().length === 0 || item.room.length > MAX_ROOM_CHARS || !ROOM_PATTERN.test(item.room)) errors.push(`${at} (${label}): room name is invalid`)
      else if (spec.engine) errors.push(`${at} (${label}): this quantity is for the whole property, not a room`)
      else room = item.room.trim()
    }
    if (spec.perRoom && !room) errors.push(`${at} (${label}): a room name is required`)

    const basis = item.basis as MeasurementBasis
    if (!MEASUREMENT_BASES.includes(basis)) return void errors.push(`${at} (${label}): basis must be MEASURED, OPERATOR_ESTIMATE or UNKNOWN`)
    const note = typeof item.note === "string" ? item.note.trim() : ""
    if (typeof item.note !== "string" && item.note !== undefined) errors.push(`${at} (${label}): note must be text`)
    if (note.length > MAX_NOTE_CHARS) errors.push(`${at} (${label}): note is longer than ${MAX_NOTE_CHARS} characters`)
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note)) errors.push(`${at} (${label}): note contains control characters`)

    let value: number | string | null = null
    let source: MeasurementSource | null = null
    let confidence: MeasurementConfidence | null = null

    if (basis === "UNKNOWN") {
      if (item.value !== null && item.value !== undefined) errors.push(`${at} (${label}): an UNKNOWN quantity cannot carry a value`)
      if (note.length < 3) errors.push(`${at} (${label}): say why it is unknown`)
    } else {
      if (item.source === undefined || !MEASUREMENT_SOURCES.includes(item.source as MeasurementSource)) errors.push(`${at} (${label}): source must be one of ${MEASUREMENT_SOURCES.join(", ")}`)
      else source = item.source as MeasurementSource
      if (item.confidence === undefined || !MEASUREMENT_CONFIDENCE.includes(item.confidence as MeasurementConfidence)) errors.push(`${at} (${label}): confidence must be high, medium or low`)
      else confidence = item.confidence as MeasurementConfidence
      if (source) {
        if (basis === "MEASURED" && !MEASURED_SOURCES.includes(source)) errors.push(`${at} (${label}): a MEASURED value must come from a tape, laser or scaled floor plan; use OPERATOR_ESTIMATE for a stated figure`)
        if ((source === "TAPE_MEASURE" || source === "LASER_MEASURE") && basis !== "MEASURED") errors.push(`${at} (${label}): a tape or laser reading is a MEASURED value`)
      }
      if ((basis === "OPERATOR_ESTIMATE" || confidence === "low") && note.length < 5) errors.push(`${at} (${label}): explain the estimate or the low confidence`)

      // the value itself
      if (spec.unit === "category") {
        if (typeof item.value !== "string" || !spec.values!.includes(item.value)) errors.push(`${at} (${label}): value must be one of ${spec.values!.join(", ")}`)
        else value = item.value
      } else if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
        errors.push(`${at} (${label}): value must be a number`)
      } else {
        const v = item.value
        const [hardLo, hardHi] = spec.hard!
        const [plLo, plHi] = spec.plausible!
        if (spec.integer && !Number.isInteger(v)) errors.push(`${at} (${label}): value must be a whole number`)
        else if (v < hardLo || v > hardHi) errors.push(`${at} (${label}): ${v} is outside the allowed range ${hardLo} to ${hardHi} ${spec.unit}`)
        else {
          value = v
          if (v < plLo || v > plHi) {
            if (item.acknowledgedImplausible !== true) errors.push(`${at} (${label}): ${v} is outside the usual range ${plLo} to ${plHi} ${spec.unit}. Check it, then resubmit with acknowledgedImplausible: true`)
            else warnings.push({ code: "IMPLAUSIBLE_ACKNOWLEDGED", key, ...(room ? { room } : {}), message: `${label}${room ? ` (${room})` : ""}: ${v} ${spec.unit} is outside the usual range ${plLo} to ${plHi}; accepted because the operator confirmed it.` })
          }
        }
      }
    }

    if (errors.length === startErrors) {
      entries.push({ key, ...(room ? { room } : {}), value, unit: spec.unit, basis, source, confidence, note, ...(item.acknowledgedImplausible === true ? { acknowledgedImplausible: true } : {}) })
    }
  })

  // conflicts across entries
  const seen = new Map<string, number>()
  entries.forEach((e, i) => {
    const k = roomKey(e)
    if (seen.has(k)) errors.push(`entries[${i}]: conflicting values for ${MEASUREMENT_SPEC[e.key].label}${e.room ? ` (${e.room})` : ""}. Record one value and explain the other source in its note`)
    seen.set(k, i)
  })
  const floor = entries.find((e) => e.key === "floorAreaSqm" && typeof e.value === "number")
  if (floor) {
    const byRoom = new Map<string, { l?: number; w?: number }>()
    for (const e of entries) {
      if ((e.key === "room_length_m" || e.key === "room_width_m") && typeof e.value === "number" && e.room) {
        const r = byRoom.get(e.room.toLowerCase()) ?? {}
        if (e.key === "room_length_m") r.l = e.value
        else r.w = e.value
        byRoom.set(e.room.toLowerCase(), r)
      }
    }
    // an input-consistency check on the operator's own figures: rooms cannot be larger than the property they are in
    const roomsTotal = [...byRoom.values()].reduce((s, r) => s + (r.l && r.w ? r.l * r.w : 0), 0)
    if (roomsTotal > (floor.value as number)) errors.push(`CONFLICT: the room dimensions entered add up to ${Math.round(roomsTotal * 10) / 10} sqm, more than the total floor area of ${floor.value} sqm. One of them is wrong`)
  }

  for (const e of entries) {
    if (MEASUREMENT_SPEC[e.key].engine && e.basis === "OPERATOR_ESTIMATE") warnings.push({ code: "ESTIMATED_ENGINE_QUANTITY", key: e.key, message: `${MEASUREMENT_SPEC[e.key].label} is an operator estimate, not a measurement; costs that depend on it are indicative.` })
    if (e.key === "floorAreaSqm" && e.basis === "UNKNOWN") warnings.push({ code: "FLOOR_AREA_UNKNOWN", key: e.key, message: "Floor area is unknown: the existing engine will price flooring on a room-count basis and say so." })
  }

  return errors.length ? { ok: false, errors } : { ok: true, entries, warnings }
}

export type MeasurementRequest = { idempotencyKey: string; basedOnVersion: number; changeNote: string | null; entries: MeasurementEntry[]; warnings: MeasurementWarning[] }

export function parseMeasurementRequest(body: unknown): Parsed<MeasurementRequest> {
  if (!isObject(body)) return { ok: false, errors: ["Body must be a JSON object"] }
  const errors = Object.keys(body).filter((k) => !["idempotencyKey", "basedOnVersion", "changeNote", "entries"].includes(k)).map((k) => `Unknown field: ${k}`)
  if (typeof body.idempotencyKey !== "string" || !KEY_PATTERN.test(body.idempotencyKey)) errors.push("idempotencyKey must be 8-100 characters of A-Z a-z 0-9 _ -")
  if (typeof body.basedOnVersion !== "number" || !Number.isInteger(body.basedOnVersion) || body.basedOnVersion < 0) errors.push("basedOnVersion must be the version you were looking at (0 for the first set)")
  const changeNote = typeof body.changeNote === "string" ? body.changeNote.trim() : null
  if (body.changeNote !== undefined && body.changeNote !== null && typeof body.changeNote !== "string") errors.push("changeNote must be text")
  if (typeof body.basedOnVersion === "number" && body.basedOnVersion > 0 && (!changeNote || changeNote.length < 5)) errors.push("changeNote is required when correcting an earlier version: say what was wrong")
  if (changeNote && changeNote.length > MAX_NOTE_CHARS) errors.push(`changeNote is longer than ${MAX_NOTE_CHARS} characters`)
  const validated = validateMeasurementEntries(body.entries)
  if (!validated.ok) errors.push(...validated.errors)
  if (errors.length || !validated.ok) return { ok: false, errors }
  return { ok: true, value: { idempotencyKey: body.idempotencyKey as string, basedOnVersion: body.basedOnVersion as number, changeNote, entries: validated.entries, warnings: validated.warnings } }
}

const describeEntry = (e: MeasurementEntry) => `${e.value === null ? "unknown" : `${e.value} ${e.unit === "category" ? "" : e.unit}`.trim()} [${e.basis}${e.source ? `, ${e.source}` : ""}${e.confidence ? `, ${e.confidence}` : ""}] ${e.note}`.trim()

/** What changed between two versions, for the correction history. */
export function diffMeasurementSets(previous: readonly MeasurementEntry[], next: readonly MeasurementEntry[]): MeasurementChange[] {
  const a = new Map(previous.map((e) => [roomKey(e), e]))
  const b = new Map(next.map((e) => [roomKey(e), e]))
  const out: MeasurementChange[] = []
  for (const [k, e] of b) {
    const old = a.get(k)
    if (!old) out.push({ key: e.key, ...(e.room ? { room: e.room } : {}), change: "ADDED", from: null, to: describeEntry(e) })
    else if (describeEntry(old) !== describeEntry(e)) out.push({ key: e.key, ...(e.room ? { room: e.room } : {}), change: "CHANGED", from: describeEntry(old), to: describeEntry(e) })
  }
  for (const [k, e] of a) if (!b.has(k)) out.push({ key: e.key, ...(e.room ? { room: e.room } : {}), change: "REMOVED", from: describeEntry(e), to: null })
  return out
}

/**
 * Chooses which entered quantities may be handed to the existing engine. Only MEASURED or OPERATOR_ESTIMATE values
 * of the four engine quantities qualify; UNKNOWN or missing ones are never replaced by a default here.
 */
export function basicsFromMeasurements(entries: readonly MeasurementEntry[]): MeasurementBasics {
  const find = (key: string) => entries.find((e) => e.key === key && !e.room)
  const usable = (e: MeasurementEntry | undefined): e is MeasurementEntry & { value: number | string } => Boolean(e && e.basis !== "UNKNOWN" && e.value !== null)
  const blockedBy: string[] = []
  const basisNotes: string[] = []
  const unresolved: string[] = []
  const how = (e: MeasurementEntry) => `${e.basis === "MEASURED" ? "measured" : "operator estimate"}${e.source ? ` (${e.source.toLowerCase().replace(/_/g, " ")}` : ""}${e.confidence ? `, ${e.confidence} confidence)` : e.source ? ")" : ""}`

  const bedrooms = find("bedrooms")
  const bathrooms = find("bathrooms")
  const floor = find("floorAreaSqm")
  const kitchen = find("kitchenSize")

  for (const [name, e, code] of [["Bedrooms", bedrooms, "BEDROOMS"], ["Bathrooms", bathrooms, "BATHROOMS"]] as const) {
    if (!usable(e)) {
      blockedBy.push(`${code}_UNKNOWN`)
      unresolved.push(`${name} not recorded or unknown: no engine cost can be produced.`)
    } else {
      basisNotes.push(`${name}: ${e.value}, ${how(e)}`)
      if (e.basis === "OPERATOR_ESTIMATE") unresolved.push(`${name} is an estimate (${e.value}), not a measurement.`)
    }
  }
  if (usable(floor)) {
    basisNotes.push(`Floor area: ${floor.value} sqm, ${how(floor)}`)
    if (floor.basis === "OPERATOR_ESTIMATE") unresolved.push(`Floor area is an estimate (${floor.value} sqm), not a measurement.`)
  } else {
    unresolved.push("Floor area is unknown: flooring is priced by the engine on a room-count basis, which it flags as less accurate.")
  }
  if (usable(kitchen)) {
    basisNotes.push(`Kitchen size: ${kitchen.value}, ${how(kitchen)}`)
    if (kitchen.basis === "OPERATOR_ESTIMATE") unresolved.push(`Kitchen size is an estimate (${kitchen.value}).`)
  } else {
    unresolved.push("Kitchen size is not recorded: a kitchen replacement cannot be costed until it is.")
  }

  if (blockedBy.length) return { basics: null, blockedBy, basisNotes, unresolved }
  const basics: PropertyBasics = {
    bedrooms: (bedrooms as MeasurementEntry).value as number,
    bathrooms: (bathrooms as MeasurementEntry).value as number,
    ...(usable(floor) ? { floorAreaSqm: floor.value as number } : {}),
    ...(usable(kitchen) ? { kitchenSize: kitchen.value as KitchenSize } : {}),
  }
  return { basics, blockedBy, basisNotes, unresolved }
}
