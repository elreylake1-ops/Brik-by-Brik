export type DealInputs = {
  purchasePrice: number
  gdv: number
  refurbCost: number
}

export type DealResult = {
  totalCost: number
  profit: number
  maxOffer: number
  verdict: "DEAL" | "NO DEAL" | null
}
