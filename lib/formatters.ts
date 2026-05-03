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
