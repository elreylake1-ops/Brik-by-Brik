import type { Trade } from "@/types/refurb"

export type TradeRateEntry = {
  trade: Trade
  dayRate: number // £ per day
  notes: string
}

// Baseline day rates — London/South East assumption, 2024/2025 market.
// Adjust per region before generating quotes.
export const TRADE_RATES: Record<Trade, TradeRateEntry> = {
  builder: {
    trade: "builder",
    dayRate: 400,
    notes: "General builder. London/SE rate. Covers structural, groundwork, general construction.",
  },
  labourer: {
    trade: "labourer",
    dayRate: 200,
    notes: "General labourer. Strip-out, skip loading, site prep.",
  },
  electrician: {
    trade: "electrician",
    dayRate: 400,
    notes: "NICEIC qualified. Day rate excludes materials. Full rewire priced as fixed job.",
  },
  plumber: {
    trade: "plumber",
    dayRate: 400,
    notes: "Residential plumbing. Excludes gas work. First and second fix.",
  },
  plasterer: {
    trade: "plasterer",
    dayRate: 250,
    notes: "Skim or board-and-skim. Rate per day. Coverage: approx 20-25 sqm/day for skim.",
  },
  decorator: {
    trade: "decorator",
    dayRate: 220,
    notes: "Paint and prep. Rate excludes materials. Includes caulking and light sanding.",
  },
  roofer: {
    trade: "roofer",
    dayRate: 320,
    notes: "Day rate for labour. Major roof replacements typically priced as fixed quote.",
  },
  gas_engineer: {
    trade: "gas_engineer",
    dayRate: 400,
    notes: "Gas Safe registered. Boiler swap typically £800-1,200 labour fixed. Day rate for additional gas work.",
  },
  // Assumption-based rates — confirm with local quotes before using in live deals
  carpenter: {
    trade: "carpenter",
    dayRate: 280,
    notes: "ASSUMPTION: £280/day. Covers first-fix framing, second-fix joinery, door hanging, skirting. Confirm locally.",
  },
  tiler: {
    trade: "tiler",
    dayRate: 250,
    notes: "ASSUMPTION: £250/day. Rate varies with tile size and pattern complexity. Large format tiles slower. Confirm locally.",
  },
  waste_removal: {
    trade: "waste_removal",
    dayRate: 150,
    notes: "ASSUMPTION: £150/load equivalent (skip hire or man-and-van). Full refurb typically needs 2-4 loads. Confirm locally.",
  },
}
