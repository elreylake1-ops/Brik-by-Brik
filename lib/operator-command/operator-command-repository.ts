import type { DealSnapshot, OperatorDeal, PipelineEvent } from "@/types/operator-command"

export type CreateOperatorDealInput = Omit<
  OperatorDeal,
  "id" | "created_at" | "updated_at" | "archived_at"
> & {
  id?: OperatorDeal["id"]
  created_at?: OperatorDeal["created_at"]
  updated_at?: OperatorDeal["updated_at"]
  archived_at?: OperatorDeal["archived_at"]
}

export type UpdateOperatorDealMetadataInput = Partial<
  Pick<OperatorDeal, "address" | "source_url" | "classification" | "notes" | "updated_at">
>

export type CreateDealSnapshotInput = Pick<DealSnapshot, "deal_id" | "engine_snapshot_json"> & {
  id?: DealSnapshot["id"]
  created_at?: DealSnapshot["created_at"]
}

export type RecordPipelineEventInput = Omit<PipelineEvent, "id" | "created_at"> & {
  id?: PipelineEvent["id"]
  created_at?: PipelineEvent["created_at"]
}

export interface OperatorCommandRepository {
  createOperatorDeal(input: CreateOperatorDealInput): Promise<OperatorDeal>
  getOperatorDealById(id: string): Promise<OperatorDeal | null>
  updateOperatorDealMetadata(id: string, input: UpdateOperatorDealMetadataInput): Promise<OperatorDeal>
  archiveOperatorDeal(id: string): Promise<OperatorDeal>
  createDealSnapshot(input: CreateDealSnapshotInput): Promise<DealSnapshot>
  getLatestDealSnapshot(dealId: string): Promise<DealSnapshot | null>
  recordPipelineEvent(input: RecordPipelineEventInput): Promise<PipelineEvent>
}
