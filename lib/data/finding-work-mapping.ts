import type { ScopeField, ScopeLevel, WorkItemKind } from "@/types/refurb-integration"

// VISIBLE business configuration: which viewing-checklist checks can propose which refurbishment work.
// Checks are referenced by id only. Labels below are this project's own neutral wording and carry no checklist text.
//
// Rules the adapter applies (lib/refurb-integration/findings-to-work.ts):
//  - A work item exists only when a human has accepted or edited an AI suggestion and the check's effective state is
//    CONCERN (a works finding) or SPECIALIST_REVIEW (a specialist must look first).
//  - ENGINE_SCOPE items change a field of the existing RefurbScopeInput and are priced by the existing engine, never here.
//  - UNPRICED items are listed for builders with no figure. We do not invent cost for works the engine cannot price.
//  - Checks not listed here are not physical works (transaction, legal, financial, services and similar checks) and can
//    never create a work item.
//  - Levels are ordered least to most work. A finding proposes the LOWEST level; only a human can choose a higher one.

export type WorkMapping = {
  id: string
  kind: Exclude<WorkItemKind, "SPECIALIST_INSPECTION">
  label: string
  area: string
  checkIds: readonly string[]
  /** ENGINE_SCOPE only */
  scopeField?: ScopeField
  levels?: readonly ScopeLevel[] // ordered least to most work
  proposedLevel?: ScopeLevel // the lowest level that means "some work"
  /** Which engine tasks (room + scope on GeneratedRefurbTask) this item's field produces, so cost can be traced back to it. */
  engineTaskSelector?: { room: string; scope: string }[]
  quantityNote: string
}

export const FINDING_WORK_MAPPINGS: readonly WorkMapping[] = [
  {
    id: "roof",
    kind: "ENGINE_SCOPE",
    label: "Roof works",
    area: "roof",
    checkIds: ["C01", "C02", "C03"],
    scopeField: "majorWorks.roof",
    levels: [false, true],
    proposedLevel: true,
    engineTaskSelector: [{ room: "whole_property", scope: "roof" }],
    quantityNote: "Extent unknown. The engine holds a single placeholder allowance for roof works; real cost varies widely and needs builder quotes.",
  },
  {
    id: "electrics",
    kind: "ENGINE_SCOPE",
    label: "Electrical works",
    area: "electrics",
    checkIds: ["C37", "C38"],
    scopeField: "majorWorks.rewire",
    levels: [false, true],
    proposedLevel: true,
    engineTaskSelector: [{ room: "whole_property", scope: "rewire" }],
    quantityNote: "Whether a full rewire is needed is unknown from video. The engine's baseline assumes a 3-bed property; an electrician's inspection is needed.",
  },
  {
    id: "heating",
    kind: "ENGINE_SCOPE",
    label: "Heating / boiler works",
    area: "heating",
    checkIds: ["C33", "C34", "C35", "C36"],
    scopeField: "majorWorks.boiler",
    levels: [false, true],
    proposedLevel: true,
    engineTaskSelector: [{ room: "whole_property", scope: "boiler" }],
    quantityNote: "Extent unknown. The engine assumes a like-for-like boiler swap; a gas-safe engineer must confirm the system's condition.",
  },
  {
    id: "flooring",
    kind: "ENGINE_SCOPE",
    label: "Flooring works",
    area: "floors",
    checkIds: ["C24", "C25", "C26", "C27"],
    scopeField: "flooring.replaceWholeProperty",
    levels: [false, true],
    proposedLevel: true,
    engineTaskSelector: [{ room: "whole_property", scope: "flooring_replacement" }],
    quantityNote: "Extent unknown. The engine only prices whole-property replacement; the real affected area may be much smaller.",
  },
  {
    id: "kitchen",
    kind: "ENGINE_SCOPE",
    label: "Kitchen works",
    area: "kitchen",
    checkIds: ["C39", "C40"],
    scopeField: "kitchen.scope",
    levels: ["keep", "refresh", "upgrade", "full_replace"],
    proposedLevel: "refresh",
    engineTaskSelector: [
      { room: "kitchen", scope: "refresh" },
      { room: "kitchen", scope: "upgrade" },
      { room: "kitchen", scope: "full_replace" },
    ],
    quantityNote: "Extent unknown. The engine prices only a full replacement; lighter levels are listed but carry no engine price.",
  },
  {
    id: "bathroom",
    kind: "ENGINE_SCOPE",
    label: "Bathroom works",
    area: "bathroom",
    checkIds: ["C41", "C42", "V05"],
    scopeField: "bathroom.scope",
    levels: ["cosmetic", "partial", "full_replace"],
    proposedLevel: "partial",
    engineTaskSelector: [
      { room: "bathroom", scope: "partial" },
      { room: "bathroom", scope: "full_replace" },
    ],
    quantityNote: "Extent unknown. The engine prices only a full replacement; a partial refit is listed but carries no engine price.",
  },
  { id: "chimneys", kind: "UNPRICED", label: "Chimney repairs", area: "chimneys", checkIds: ["C04", "C05"], quantityNote: "Number and condition of stacks unknown. Needs scaffold and builder inspection." },
  { id: "rainwater", kind: "UNPRICED", label: "Gutters and downpipes", area: "rainwater", checkIds: ["C06", "C07"], quantityNote: "Length and access unknown." },
  { id: "external-walls", kind: "UNPRICED", label: "Facade and masonry repairs", area: "facade", checkIds: ["C08", "C09", "C10"], quantityNote: "Area and cause unknown; cracking needs assessment before pricing." },
  { id: "windows-doors", kind: "UNPRICED", label: "Windows and external doors", area: "windows and doors", checkIds: ["C11", "C12", "C13", "C14"], quantityNote: "Count of affected units unknown; glazing-unit versus frame replacement unknown." },
  { id: "grounds", kind: "UNPRICED", label: "Grounds and garden works", area: "grounds", checkIds: ["C15", "C16", "C44"], quantityNote: "Area unknown." },
  { id: "ceilings", kind: "UNPRICED", label: "Ceiling repairs", area: "ceilings", checkIds: ["C17", "C18", "C19"], quantityNote: "Areas unknown; sampling may be needed before disturbing suspect materials." },
  { id: "internal-walls", kind: "UNPRICED", label: "Plaster and partition repairs", area: "plaster and partitions", checkIds: ["C20", "C21", "C22", "C23"], quantityNote: "Areas unknown; cause of cracking or damp staining needs assessment." },
  { id: "internal-doors", kind: "UNPRICED", label: "Interior door repairs", area: "interior doors", checkIds: ["C28", "C29"], quantityNote: "Count unknown." },
  { id: "wall-tiling", kind: "UNPRICED", label: "Tiling repairs", area: "tiling", checkIds: ["C30"], quantityNote: "Area unknown." },
  { id: "drainage", kind: "UNPRICED", label: "Drainage", area: "drainage", checkIds: ["C31", "C32"], quantityNote: "Condition cannot be judged from video; a drainage survey is normally needed before pricing." },
  { id: "decoration", kind: "UNPRICED", label: "Decoration", area: "decoration", checkIds: ["C43"], quantityNote: "Rooms and areas unknown." },
  { id: "general", kind: "UNPRICED", label: "General condition works", area: "general", checkIds: ["C45"], quantityNote: "Nature and extent unknown." },
]

export const MAPPED_CHECK_IDS: ReadonlySet<string> = new Set(FINDING_WORK_MAPPINGS.flatMap((m) => m.checkIds))

export function mappingForCheck(checkId: string): WorkMapping | undefined {
  return FINDING_WORK_MAPPINGS.find((m) => m.checkIds.includes(checkId))
}

// Visible default assumptions used when deriving a scope. Nothing here is hidden in logic.
export const SCOPE_DEFAULTS = {
  kitchenScope: "keep",
  bathroomScope: "cosmetic",
  bedroomScope: "none",
  // Used only to fill the engine's required field when NO kitchen replacement is in scope (it is then never costed).
  kitchenSizeWhenNotCosted: "medium",
  note: "Areas with no confirmed finding are assumed to need no works. That is an absence of a reviewed finding in a video review, not evidence that the area is sound.",
} as const

// Standard exclusions printed on every builder pack (editable business wording).
export const BUILDER_PACK_EXCLUSIONS: readonly string[] = [
  "Anything not itemised in this pack.",
  "Hidden or concealed defects, including structure, damp, services and drainage behind finishes.",
  "Works to areas for which no finding has been confirmed.",
  "Planning, building-control, party-wall and statutory fees unless a builder includes them.",
  "Furniture, appliances and fittings unless stated.",
  "Asbestos or other hazardous-material surveys and removal.",
]

// Wording shown to BUILDERS for each work item. Separate from quantityNote (which is internal and may refer to how our
// own cost engine treats the item). Nothing here may mention rates, allowances, estimates or our engine.
export const BUILDER_NOTES: Readonly<Record<string, string>> = {
  roof: "Extent and condition of the roof covering and structure to be established by the builder on site. Please state what you have assumed.",
  electrics: "Condition of the installation to be established by a qualified electrician. Please state whether you have assumed a full rewire, partial works, or testing with remedials.",
  heating: "Type and condition of the heating system to be established by a qualified gas engineer. Please state what you have assumed.",
  flooring: "Extent of flooring works to be confirmed on site. Please state the areas and finishes you have assumed.",
  kitchen: "Extent of kitchen works to be confirmed on site. Please state the specification you have assumed.",
  bathroom: "Extent of bathroom works to be confirmed on site. Please state the specification you have assumed.",
}

export const BUILDER_INSPECTION_NOTE = "A specialist inspection and report is requested before works to this item are priced."

export const builderNoteFor = (mappingId: string): string =>
  BUILDER_NOTES[mappingId] ?? FINDING_WORK_MAPPINGS.find((m) => m.id === mappingId)?.quantityNote ?? "Nature and extent to be established by the builder on site."
