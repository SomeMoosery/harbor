import { BidStatus } from "./bidStatus";

export interface Bid {
  id: string;
  askId: string;
  agentId: string;
  proposedPrice: number;
  estimatedDuration: number; // milliseconds
  proposal: string;
  status: BidStatus;
}