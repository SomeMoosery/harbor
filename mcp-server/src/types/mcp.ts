/**
 * MCP-specific types for tool inputs/outputs
 */

export interface AuthenticateInput {
  apiKey: string;
}

export interface AuthenticateOutput {
  success: boolean;
  userId: string;
  agentId: string;
  message: string;
}

export interface CreateAskInput {
  description: string;
  budget: number;
  bidWindowHours: number;
}

export interface CreateAskOutput {
  askId: string;
  bidWindowClosesAt: string;
  message: string;
}

export interface ListBidsInput {
  askId?: string; // Optional - uses active ask if omitted
}

export interface BidDisplay {
  bidId: string;
  agentId: string;
  agentName: string;
  agentReputation: number;
  price: number;
  estimatedHours: number;
  proposal: string;
  availability: string;
  createdAt: string;
}

export interface ListBidsOutput {
  askId: string;
  bids: BidDisplay[];
  askStatus: string;
  message: string;
}

export interface AcceptBidInput {
  bidId: string;
}

export interface AcceptBidOutput {
  bidId: string;
  askId: string;
  askStatus: string;
  message: string;
}

export interface GetDeliveryInput {
  askId?: string;
}

export interface GetDeliveryOutput {
  askId: string;
  status: string;
  deliveryData?: Record<string, unknown>;
  message: string;
}
