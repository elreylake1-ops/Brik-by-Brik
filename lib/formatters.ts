const LABEL_MAP: Record<string, string> = {
  full_replace: "Full Replacement",
  cosmetic_refresh: "Cosmetic Refresh",
  whole_property: "Whole Property",
  gas_engineer: "Gas Engineer",
  waste_removal: "Waste Removal",
  labourer: "Labourer",
  full_refurb: "Full Refurb",
  partial: "Partial Refurb",
  cosmetic: "Cosmetic",
  keep: "Keep as-is",
  refresh: "Refresh",
  upgrade: "Upgrade",
  rewire: "Rewire",
  boiler: "Boiler",
  roof: "Roof",
  paint: "Paint",
  flooring: "Flooring",
  none: "None",
}

export function formatLabel(value: string): string {
  if (LABEL_MAP[value]) return LABEL_MAP[value]
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function formatWithCommas(value: number): string {
  if (!isFinite(value) || isNaN(value) || value === 0) return ""
  return new Intl.NumberFormat("en-GB").format(value)
}

export function formatCurrency(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "£0.00"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatProfit(value: number): string {
  const formatted = formatCurrency(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

export function formatPercent(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "0.00%"
  return `${value.toFixed(2)}%`
}
