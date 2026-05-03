import type { DealInputs, DealResult } from "@/types/deal"

export function calculateTotalCost(purchasePrice: number, refurbCost: number): number {
  return purchasePrice + refurbCost
}

export function calculateProfit(gdv: number, totalCost: number): number {
  return gdv - totalCost
}

export function calculateMaxOffer(gdv: number, refurbCost: number): number {
  return 0.7 * gdv - refurbCost
}

export function getDealVerdict(purchasePrice: number, maxOffer: number): "DEAL" | "NO DEAL" {
  return purchasePrice <= maxOffer ? "DEAL" : "NO DEAL"
}

export function analyzeDeal(inputs: DealInputs): DealResult {
  const { purchasePrice, gdv, refurbCost } = inputs

  if (purchasePrice === 0 && gdv === 0 && refurbCost === 0) {
    return { totalCost: 0, profit: 0, maxOffer: 0, verdict: null }
  }

  const totalCost = calculateTotalCost(purchasePrice, refurbCost)
  const profit = calculateProfit(gdv, totalCost)
  const maxOffer = calculateMaxOffer(gdv, refurbCost)
  const verdict = getDealVerdict(purchasePrice, maxOffer)

  return { totalCost, profit, maxOffer, verdict }
}
