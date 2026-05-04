import type { RefurbTaskTemplate } from "@/types/refurb"
import { TRADE_RATES } from "@/lib/data/trade-rates"

const r = TRADE_RATES // shorthand

// Initial task templates for Phase 1A.
// Each entry = one trade's contribution to one scope.
// labourDays and materialCost are base-unit values; scaled by quantity at generation time.

export const TASK_TEMPLATES: RefurbTaskTemplate[] = [

  // ── Kitchen: Full Replacement ───────────────────────────────────────────────
  // Scoped for a small kitchen. Medium and large scaling applied at generation time.
  {
    id: "kitchen-full-replace-strip",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Strip out existing kitchen",
    trade: "labourer",
    labourDays: 1,
    dayRate: r.labourer.dayRate,
    materialCost: 0,
    scalingRule: "fixed",
    notes: "1 day for small kitchen strip-out including disconnect. Add 0.5 days for medium, 1 day for large.",
  },
  {
    id: "kitchen-full-replace-units",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Supply and install kitchen units",
    trade: "carpenter",
    labourDays: 2.5,
    dayRate: r.carpenter.dayRate,
    materialCost: 3500, // Units + worktop + sink/tap (budget, small kitchen)
    scalingRule: "fixed",
    dependency: "kitchen-full-replace-strip",
    notes: "2.5 days fitting for small kitchen. Materials: budget flat-pack units £2,500 + worktop £350 + sink/tap £150. Scale for medium (+1 day labour, +£1,500 materials), large (+2 days, +£3,000).",
  },
  {
    id: "kitchen-full-replace-plumbing",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Kitchen plumbing — sink and appliance connections",
    trade: "plumber",
    labourDays: 1,
    dayRate: r.plumber.dayRate,
    materialCost: 80, // Pipework, isolation valves, waste fittings
    scalingRule: "fixed",
    dependency: "kitchen-full-replace-units",
    notes: "1 day for sink hook-up and dishwasher/washing machine connections. Materials are fittings only.",
  },
  {
    id: "kitchen-full-replace-electrical",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Kitchen electrical — sockets, extractor, lighting",
    trade: "electrician",
    labourDays: 0.5,
    dayRate: r.electrician.dayRate,
    materialCost: 120, // Sockets, switches, extractor wiring
    scalingRule: "fixed",
    notes: "0.5 day assumes existing circuits usable. Full rewire context: include rewire task instead.",
  },
  {
    id: "kitchen-full-replace-tiling",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Kitchen wall tiling — splashback",
    trade: "tiler",
    labourDays: 1,
    dayRate: r.tiler.dayRate,
    materialCost: 200, // ~10 sqm tiles + adhesive + grout
    scalingRule: "fixed",
    dependency: "kitchen-full-replace-units",
    notes: "ASSUMPTION: splashback area only (~10 sqm). Full tile-out kitchen add 1 day labour and ~£300 materials.",
  },
  {
    id: "kitchen-full-replace-decoration",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Kitchen decoration — paint and finish",
    trade: "decorator",
    labourDays: 1,
    dayRate: r.decorator.dayRate,
    materialCost: 80, // Paint, filler, tape
    scalingRule: "fixed",
    dependency: "kitchen-full-replace-tiling",
  },
  {
    id: "kitchen-full-replace-waste",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Waste removal — kitchen strip-out",
    trade: "waste_removal",
    labourDays: 1,
    dayRate: r.waste_removal.dayRate,
    materialCost: 0,
    scalingRule: "fixed",
    notes: "ASSUMPTION: 1 skip load or van load for kitchen unit removal. Large kitchen may need 2.",
  },

  // ── Bathroom: Full Refurbishment ───────────────────────────────────────────
  {
    id: "bathroom-full-strip",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Strip out existing bathroom",
    trade: "labourer",
    labourDays: 0.5,
    dayRate: r.labourer.dayRate,
    materialCost: 0,
    scalingRule: "per_bathroom",
  },
  {
    id: "bathroom-full-plumbing",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Bathroom plumbing — suite installation",
    trade: "plumber",
    labourDays: 2,
    dayRate: r.plumber.dayRate,
    materialCost: 700, // Budget suite £500 + taps/waste £200
    scalingRule: "per_bathroom",
    dependency: "bathroom-full-strip",
    notes: "2 days per bathroom for bath, basin, toilet installation. Materials: budget suite. Upgrade to mid adds £700/bathroom.",
  },
  {
    id: "bathroom-full-tiling",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Bathroom tiling — walls and floor",
    trade: "tiler",
    labourDays: 2.5,
    dayRate: r.tiler.dayRate,
    materialCost: 450, // ~18 sqm walls + 4 sqm floor @ £18/sqm + adhesive/grout
    scalingRule: "per_bathroom",
    dependency: "bathroom-full-plumbing",
    notes: "ASSUMPTION: standard bathroom ~4 sqm floor, ~15 sqm walls. Budget ceramic tiles.",
  },
  {
    id: "bathroom-full-plastering",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Bathroom plastering — patch and skim",
    trade: "plasterer",
    labourDays: 0.5,
    dayRate: r.plasterer.dayRate,
    materialCost: 40,
    scalingRule: "per_bathroom",
    notes: "Patch plaster around new fixtures. Full replaster if walls in poor condition — add 1 day.",
  },
  {
    id: "bathroom-full-decoration",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Bathroom decoration — paint",
    trade: "decorator",
    labourDays: 0.5,
    dayRate: r.decorator.dayRate,
    materialCost: 50,
    scalingRule: "per_bathroom",
    dependency: "bathroom-full-plastering",
  },
  {
    id: "bathroom-full-waste",
    room: "bathroom",
    scope: "full_replace",
    taskName: "Waste removal — bathroom strip-out",
    trade: "waste_removal",
    labourDays: 0.5,
    dayRate: r.waste_removal.dayRate,
    materialCost: 0,
    scalingRule: "per_bathroom",
    notes: "ASSUMPTION: 0.5 load per bathroom. Adjust if cast iron bath present.",
  },

  // ── Bedroom: Cosmetic Refresh ───────────────────────────────────────────────
  {
    id: "bedroom-cosmetic-decoration",
    room: "bedroom",
    scope: "cosmetic_refresh",
    taskName: "Bedroom decoration — walls and ceiling",
    trade: "decorator",
    labourDays: 1,
    dayRate: r.decorator.dayRate,
    materialCost: 80, // Paint, primer, filler per bedroom
    scalingRule: "per_bedroom",
    notes: "1 day per bedroom for prep and 2-coat paint. Double bedroom assumed. Single/box room: 0.75 days.",
  },
  {
    id: "bedroom-cosmetic-carpentry",
    room: "bedroom",
    scope: "cosmetic_refresh",
    taskName: "Bedroom carpentry — skirting, architrave, door",
    trade: "carpenter",
    labourDays: 0.5,
    dayRate: r.carpenter.dayRate,
    materialCost: 120, // Skirting, architrave, door handle
    scalingRule: "per_bedroom",
    notes: "ASSUMPTION: minor repairs/replacement only. New door or fitted wardrobe priced separately.",
  },

  // ── Flooring: Whole Property Replacement ───────────────────────────────────
  {
    id: "flooring-whole-property-prep",
    room: "whole_property",
    scope: "flooring_replacement",
    taskName: "Floor prep — lift and dispose existing flooring",
    trade: "labourer",
    labourDays: 0.5,
    dayRate: r.labourer.dayRate,
    materialCost: 0,
    scalingRule: "per_room",
    notes: "0.5 day per room to lift carpet/vinyl and dispose. Hard flooring may take longer.",
  },
  {
    id: "flooring-whole-property-laminate",
    room: "whole_property",
    scope: "flooring_replacement",
    taskName: "Laminate flooring — supply and fit",
    trade: "carpenter",
    labourDays: 0.5,
    dayRate: r.carpenter.dayRate,
    materialCost: 600, // ~40 sqm average room × £12/sqm + underlay £3/sqm
    scalingRule: "per_room",
    dependency: "flooring-whole-property-prep",
    notes: "ASSUMPTION: average room ~40 sqm. Budget laminate. Use LVT baseline for wet areas.",
  },

  // ── Major Works: Full Rewire ────────────────────────────────────────────────
  {
    id: "major-rewire-first-fix",
    room: "whole_property",
    scope: "rewire",
    taskName: "Full rewire — first fix",
    trade: "electrician",
    labourDays: 4,
    dayRate: r.electrician.dayRate,
    materialCost: 1200, // Cable and consumer unit (see material-baselines: electrical-cable-rewire)
    scalingRule: "fixed",
    notes: "ASSUMPTION: 3-bed property. Add 1 day + £300 materials per additional bedroom. Includes consumer unit.",
  },
  {
    id: "major-rewire-second-fix",
    room: "whole_property",
    scope: "rewire",
    taskName: "Full rewire — second fix (sockets, switches, lights)",
    trade: "electrician",
    labourDays: 3,
    dayRate: r.electrician.dayRate,
    materialCost: 800, // Sockets, switches, light fittings (budget)
    scalingRule: "fixed",
    dependency: "major-rewire-first-fix",
    notes: "Budget spec: white plastic sockets and switches. Chrome/brushed steel add ~£300.",
  },
  {
    id: "major-rewire-make-good",
    room: "whole_property",
    scope: "rewire",
    taskName: "Rewire make-good — plastering chases",
    trade: "plasterer",
    labourDays: 2,
    dayRate: r.plasterer.dayRate,
    materialCost: 100,
    scalingRule: "fixed",
    dependency: "major-rewire-second-fix",
    notes: "Making good chased walls after rewire. 2 days typical for 3-bed. Extent depends on how much chasing was required.",
  },

  // ── Major Works: Boiler Replacement ────────────────────────────────────────
  {
    id: "major-boiler-replacement",
    room: "whole_property",
    scope: "boiler",
    taskName: "Boiler replacement — combi, supply and install",
    trade: "gas_engineer",
    labourDays: 1.5,
    dayRate: r.gas_engineer.dayRate,
    materialCost: 900, // Budget combi supply (see material-baselines: boiler-combi-budget)
    scalingRule: "fixed",
    notes: "1.5 days labour for like-for-like combi swap. Moving boiler location adds 1 day + materials. Flue, filter, and controls included in materials estimate.",
  },

  // ── Major Works: Roof ───────────────────────────────────────────────────────
  {
    id: "major-roof-placeholder",
    room: "whole_property",
    scope: "roof",
    taskName: "Roof works — survey and repair/replace",
    trade: "roofer",
    labourDays: 5,
    dayRate: r.roofer.dayRate,
    materialCost: 3000,
    scalingRule: "fixed",
    notes: "PLACEHOLDER — roof works vary significantly. Full re-roof a 3-bed terrace: £5,000-£12,000 total. Partial repair: £1,500-£4,000. This template provides a mid estimate only. Always get 3 quotes.",
  },
]
