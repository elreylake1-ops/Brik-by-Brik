export type QualityTier = "budget" | "mid" | "premium"

export type MaterialBaseline = {
  id: string
  itemName: string
  supplier: string    // Indicative supplier — not a live price feed
  unitCost: number    // £
  unit: string        // e.g. "per kitchen", "per sqm", "per unit"
  lastChecked: string // YYYY-MM — manual check date
  qualityTier: QualityTier
  notes: string
}

// Manual baseline dataset — NOT scraped, NOT live.
// Update lastChecked and unitCost after each market review.
export const MATERIAL_BASELINES: MaterialBaseline[] = [
  // ── Kitchen ────────────────────────────────────────────────────────────────
  {
    id: "kitchen-units-budget",
    itemName: "Kitchen units — flat pack, small kitchen",
    supplier: "IKEA / B&Q",
    unitCost: 2500,
    unit: "per kitchen",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Small kitchen (up to 10 units). Medium add £1,000. Large add £2,500. Excludes worktop, sink, appliances.",
  },
  {
    id: "kitchen-units-mid",
    itemName: "Kitchen units — rigid, small kitchen",
    supplier: "Howdens / Wickes",
    unitCost: 4500,
    unit: "per kitchen",
    lastChecked: "2025-01",
    qualityTier: "mid",
    notes: "Small kitchen. Medium add £1,500. Large add £3,500. Trade account pricing assumed.",
  },
  {
    id: "kitchen-worktop-laminate",
    itemName: "Laminate worktop",
    supplier: "B&Q / Howdens",
    unitCost: 350,
    unit: "per kitchen",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Budget laminate. Solid wood or quartz significantly higher.",
  },
  {
    id: "kitchen-sink-tap",
    itemName: "Sink and tap — stainless steel",
    supplier: "Screwfix / B&Q",
    unitCost: 150,
    unit: "per unit",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Inset single bowl. Mid-range tap included.",
  },

  // ── Bathroom ───────────────────────────────────────────────────────────────
  {
    id: "bathroom-suite-budget",
    itemName: "Bathroom suite — bath, basin, toilet",
    supplier: "B&Q / Victorian Plumbing",
    unitCost: 500,
    unit: "per bathroom",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Budget white suite. Shower enclosure extra. Does not include taps or waste fittings.",
  },
  {
    id: "bathroom-suite-mid",
    itemName: "Bathroom suite — bath, basin, toilet",
    supplier: "Victorian Plumbing / Bathstore",
    unitCost: 1200,
    unit: "per bathroom",
    lastChecked: "2025-01",
    qualityTier: "mid",
    notes: "Mid-range suite with taps included. Shower screen extra ~£200.",
  },
  {
    id: "bathroom-tiles-budget",
    itemName: "Ceramic wall tiles",
    supplier: "Topps Tiles / B&Q",
    unitCost: 18,
    unit: "per sqm",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Budget 300×450 ceramic. Average bathroom wall: ~12-15 sqm. Add 10% wastage.",
  },
  {
    id: "bathroom-tiles-mid",
    itemName: "Porcelain wall and floor tiles",
    supplier: "Topps Tiles",
    unitCost: 35,
    unit: "per sqm",
    lastChecked: "2025-01",
    qualityTier: "mid",
    notes: "Mid-range porcelain. Large format tiles (600×600+) may increase fitting time.",
  },

  // ── Flooring ───────────────────────────────────────────────────────────────
  {
    id: "flooring-laminate-budget",
    itemName: "Laminate flooring — AC3",
    supplier: "B&Q / Wickes",
    unitCost: 12,
    unit: "per sqm",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "8mm AC3. Add 10% wastage. Underlay ~£3/sqm extra. Suitable for living areas, not wet rooms.",
  },
  {
    id: "flooring-lvt-mid",
    itemName: "LVT (luxury vinyl tile)",
    supplier: "Karndean / Amtico via trade",
    unitCost: 28,
    unit: "per sqm",
    lastChecked: "2025-01",
    qualityTier: "mid",
    notes: "Trade pricing. Waterproof — suitable for kitchens and bathrooms. No underlay needed on flat subfloor.",
  },
  {
    id: "flooring-carpet-budget",
    itemName: "Carpet — bedroom grade",
    supplier: "Carpet Right / local trade",
    unitCost: 14,
    unit: "per sqm",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Includes budget underlay. Fitting usually included by supplier. Confirm at point of order.",
  },

  // ── Boiler ─────────────────────────────────────────────────────────────────
  {
    id: "boiler-combi-budget",
    itemName: "Combi boiler — budget",
    supplier: "Worcester Bosch / Ideal (via installer)",
    unitCost: 900,
    unit: "per unit",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Supply only. Worcester Greenstar 4000 or equivalent. Fitting ~£600-1,000 labour separately.",
  },
  {
    id: "boiler-combi-mid",
    itemName: "Combi boiler — mid-range",
    supplier: "Vaillant / Worcester Bosch",
    unitCost: 1300,
    unit: "per unit",
    lastChecked: "2025-01",
    qualityTier: "mid",
    notes: "Supply only. 10-year warranty models. Fitting ~£600-1,000 labour separately.",
  },

  // ── Electrical ─────────────────────────────────────────────────────────────
  {
    id: "electrical-consumer-unit",
    itemName: "Consumer unit — 18-way",
    supplier: "Screwfix / CEF",
    unitCost: 120,
    unit: "per unit",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "Part of full rewire materials. Hager or MK budget unit. Mid/premium upgrade available.",
  },
  {
    id: "electrical-cable-rewire",
    itemName: "Cable and accessories — full rewire, 3-bed",
    supplier: "CEF / Screwfix",
    unitCost: 1200,
    unit: "per property",
    lastChecked: "2025-01",
    qualityTier: "budget",
    notes: "ASSUMPTION: materials for 3-bed rewire. Adjust ±£300 per bedroom above/below 3. Excludes consumer unit.",
  },
]
