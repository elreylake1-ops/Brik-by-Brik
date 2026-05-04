import type { DealInputs, DealResult, FinanceCostBreakdown, TrueMaoBreakdown } from "@/types/deal"

export function calculateFinanceCost(purchasePrice: number, bridgeTermMonths: number): FinanceCostBreakdown {
  const interest = purchasePrice * 0.15 * (bridgeTermMonths / 12)
  const arrangementFee = purchasePrice * 0.02
  const exitFee = purchasePrice * 0.01
  const totalFinanceCost = interest + arrangementFee + exitFee
  return { interest, arrangementFee, exitFee, totalFinanceCost }
}

export function calculateTotalCost(
  purchasePrice: number,
  refurbCost: number,
  stampDuty: number,
  legalCosts: number,
  totalFinanceCost: number,
  saleCosts: number
): number {
  return purchasePrice + refurbCost + stampDuty + legalCosts + totalFinanceCost + saleCosts
}

export function calculateProfit(gdv: number, totalCost: number): number {
  return gdv - totalCost
}

export function calculateProfitMargin(profit: number, gdv: number): number {
  if (gdv === 0) return 0
  return (profit / gdv) * 100
}

export function calculateTrueMao(
  gdv: number,
  desiredProfitRate: number,
  refurbCost: number,
  stampDuty: number,
  legalCosts: number,
  totalFinanceCost: number,
  saleCosts: number
): number {
  const desiredProfit = gdv * desiredProfitRate
  return gdv - desiredProfit - refurbCost - stampDuty - legalCosts - totalFinanceCost - saleCosts
}

export function analyzeDeal(inputs: DealInputs): DealResult {
  const { purchasePrice, gdv, refurbCost, stampDuty, legalCosts, saleCosts, bridgeTermMonths } = inputs

  const financeCost = calculateFinanceCost(purchasePrice, bridgeTermMonths)
  const totalCost = calculateTotalCost(purchasePrice, refurbCost, stampDuty, legalCosts, financeCost.totalFinanceCost, saleCosts)
  const profit = calculateProfit(gdv, totalCost)
  const profitMargin = calculateProfitMargin(profit, gdv)

  const trueMao: TrueMaoBreakdown = {
    fifteenPercent: calculateTrueMao(gdv, 0.15, refurbCost, stampDuty, legalCosts, financeCost.totalFinanceCost, saleCosts),
    twentyPercent: calculateTrueMao(gdv, 0.20, refurbCost, stampDuty, legalCosts, financeCost.totalFinanceCost, saleCosts),
    twentyFivePercent: calculateTrueMao(gdv, 0.25, refurbCost, stampDuty, legalCosts, financeCost.totalFinanceCost, saleCosts),
  }

  return { totalCost, financeCost, profit, profitMargin, trueMao }
}
