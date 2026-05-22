import { query } from "@/lib/db/postgres"

const DEAL_OFFER_FIELDS =
  "id, deal_id, offer_amount, offer_type, offer_status, offer_rationale, seller_response, created_at"

export type DealOfferRecord = {
  id: string
  deal_id: string
  offer_amount: number
  offer_type: string
  offer_status: string
  offer_rationale: string | null
  seller_response: string | null
  created_at: string
}

export type CreateOfferInput = {
  offer_amount: number
  offer_type?: string
  offer_status?: string
  offer_rationale?: string | null
  seller_response?: string | null
}

export async function createOffer(dealId: string, input: CreateOfferInput): Promise<DealOfferRecord> {
  const result = await query<DealOfferRecord>(
    `INSERT INTO brik_by_brik_engine.deal_offers (
      deal_id,
      offer_amount,
      offer_type,
      offer_status,
      offer_rationale,
      seller_response
    ) VALUES (
      $1,
      $2,
      COALESCE($3, 'INITIAL'),
      COALESCE($4, 'DRAFT'),
      $5,
      $6
    ) RETURNING ${DEAL_OFFER_FIELDS}`,
    [
      dealId,
      input.offer_amount,
      input.offer_type ?? null,
      input.offer_status ?? null,
      input.offer_rationale ?? null,
      input.seller_response ?? null,
    ]
  )

  return result.rows[0]
}

export async function listOffersForDeal(dealId: string): Promise<DealOfferRecord[]> {
  const result = await query<DealOfferRecord>(
    `SELECT ${DEAL_OFFER_FIELDS}
     FROM brik_by_brik_engine.deal_offers
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows
}

export async function updateOfferStatus(offerId: string, status: string): Promise<DealOfferRecord | null> {
  const result = await query<DealOfferRecord>(
    `UPDATE brik_by_brik_engine.deal_offers
     SET offer_status = $2
     WHERE id = $1
     RETURNING ${DEAL_OFFER_FIELDS}`,
    [offerId, status]
  )

  return result.rows[0] ?? null
}

export async function updateSellerResponse(
  offerId: string,
  sellerResponse: string | null
): Promise<DealOfferRecord | null> {
  const result = await query<DealOfferRecord>(
    `UPDATE brik_by_brik_engine.deal_offers
     SET seller_response = $2
     WHERE id = $1
     RETURNING ${DEAL_OFFER_FIELDS}`,
    [offerId, sellerResponse]
  )

  return result.rows[0] ?? null
}

