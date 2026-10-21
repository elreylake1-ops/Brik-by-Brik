import type { MeasurementUnit } from "@/types/refurb-measurements"

// VISIBLE configuration: which measurements can be recorded, in what unit, and the ranges used to catch typing slips.
// These are input-sanity limits, not financial assumptions. "hard" limits reject; "plausible" limits require the
// operator to acknowledge an unusual value. engine:true marks the only quantities passed to the existing cost engine.

export type MeasurementSpec = {
  unit: MeasurementUnit
  engine: boolean
  integer?: boolean
  hard?: readonly [number, number]
  plausible?: readonly [number, number]
  values?: readonly string[] // category values
  perRoom?: boolean // needs a room name
  label: string
}

export const MEASUREMENT_SPEC: Readonly<Record<string, MeasurementSpec>> = {
  bedrooms: { unit: "count", engine: true, integer: true, hard: [0, 50], plausible: [1, 8], label: "Bedrooms" },
  bathrooms: { unit: "count", engine: true, integer: true, hard: [0, 50], plausible: [1, 5], label: "Bathrooms" },
  floorAreaSqm: { unit: "sqm", engine: true, hard: [1, 10_000], plausible: [20, 600], label: "Total floor area" },
  kitchenSize: { unit: "category", engine: true, values: ["small", "medium", "large"], label: "Kitchen size" },
  room_length_m: { unit: "m", engine: false, hard: [0.3, 50], plausible: [1, 12], perRoom: true, label: "Room length" },
  room_width_m: { unit: "m", engine: false, hard: [0.3, 50], plausible: [1, 12], perRoom: true, label: "Room width" },
  ceiling_height_m: { unit: "m", engine: false, hard: [1, 10], plausible: [1.8, 4], label: "Ceiling height" },
  window_count: { unit: "count", engine: false, integer: true, hard: [0, 200], plausible: [0, 30], label: "Windows" },
  external_door_count: { unit: "count", engine: false, integer: true, hard: [0, 50], plausible: [0, 6], label: "External doors" },
  roof_area_sqm: { unit: "sqm", engine: false, hard: [1, 5_000], plausible: [15, 400], label: "Roof area" },
  external_wall_area_sqm: { unit: "sqm", engine: false, hard: [1, 10_000], plausible: [20, 500], label: "External wall area" },
}

export const ENGINE_MEASUREMENT_KEYS = Object.entries(MEASUREMENT_SPEC).filter(([, s]) => s.engine).map(([k]) => k)

export const MAX_MEASUREMENT_ENTRIES = 60
export const MAX_NOTE_CHARS = 300
export const MAX_ROOM_CHARS = 60
