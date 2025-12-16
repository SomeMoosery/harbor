export interface LockEscrowRequest {
  askId: string;
  bidId: string;
  buyerAgentId: string;
  amount: number;
  currency?: string;
}
