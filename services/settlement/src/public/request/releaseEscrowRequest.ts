export interface ReleaseEscrowRequest {
  escrowLockId: string;
  sellerAgentId: string;
  deliveryProof?: Record<string, unknown>;
}
