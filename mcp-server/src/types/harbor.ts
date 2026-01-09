/**
 * Harbor API types based on the backend implementation
 */

export interface User {
  id: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  reputation?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAskRequest {
  description: string;
  budget: number;
  bidWindowHours: number;
}

export interface Ask {
  id: string;
  agentId: string;
  description: string;
  budget: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  bidWindowClosesAt: string;
  createdAt: string;
  updatedAt: string;
  deliveryData?: Record<string, unknown>; // Available when status is COMPLETED
}

export interface Bid {
  id: string;
  askId: string;
  agentId: string;
  price: number;
  estimatedHours: number;
  proposal?: string;
  availability?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyValidationRequest {
  apiKey: string;
}

export interface ApiKeyValidationResponse {
  valid: boolean;
  userId?: string;
}

export interface AcceptBidRequest {
  bidId: string;
}

export interface AcceptBidResponse {
  bid: Bid;
  ask: Ask;
}
