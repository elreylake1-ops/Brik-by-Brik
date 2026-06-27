import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import type { InvestorSummaryLatestOfferSummary } from "@/types/investor-summary"
import type { OfferType } from "@/types/operator-command"

function mapOfferRecord(offer: DealOfferRecord): InvestorSummaryLatestOfferSummary {
  return {
    offerId: offer.id,
    amount: offer.offer_amount,
    offerType: offer.offer_type as OfferType,
    offerStatus: offer.offer_status,
    rationale: offer.offer_rationale,
    sellerResponse: offer.seller_response,
    createdAt: offer.created_at,
  }
}

export function selectLatestInvestorSummaryOffer(
  offers: readonly DealOfferRecord[]
): InvestorSummaryLatestOfferSummary | null {
  const firstOffer = offers[0]
  return firstOffer ? mapOfferRecord(firstOffer) : null
}
