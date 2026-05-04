export type DealInputs = {
  purchasePrice: number
  gdv: number
  refurbCost: number
  stampDuty: number
  legalCosts: number
  saleCosts: number
  bridgeTermMonths: number
}

export type FinanceCostBreakdown = {
  interest: number
  arrangementFee: number
  exitFee: number
  totalFinanceCost: number
}

export type TrueMaoBreakdown = {
  fifteenPercent: number
  twentyPercent: number
  twentyFivePercent: number
}

export type DealResult = {
  totalCost: number
  financeCost: FinanceCostBreakdown
  profit: number
  profitMargin: number
  trueMao: TrueMaoBreakdown
}
