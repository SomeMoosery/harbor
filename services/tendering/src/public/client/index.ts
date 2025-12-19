import { z } from 'zod';
import { getServiceUrl } from '@harbor/config/ports';
import { CreateAskRequest } from '../request/createAskRequest';
import { Ask } from '../model/ask';
import { Bid } from '../model/bid';
import { CreateBidRequest } from '../request/createBidRequest';
import { askSchema, bidSchema } from '../schemas';

/**
 * Type-safe HTTP client for Tendering service
 * Other services use this to communicate with the Tendering service
 */
export class TenderingClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('tendering');
  }

  async createAsk(agentId: string, data: CreateAskRequest): Promise<Ask> {
    const response = await fetch(`${this.baseUrl}/asks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create ask: ${response.statusText}`);
    }

    const json = await response.json();
    return askSchema.parse(json);
  }

  async getAsk(id: string): Promise<Ask> {
    const response = await fetch(`${this.baseUrl}/asks/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get ask: ${response.statusText}`);
    }

    const json = await response.json();
    return askSchema.parse(json);
  }

  async listAsks(filters?: { status?: string; createdBy?: string }): Promise<Ask[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.createdBy) params.append('createdBy', filters.createdBy);

    const url = `${this.baseUrl}/asks${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to list asks: ${response.statusText}`);
    }

    const json = await response.json();
    return z.array(askSchema).parse(json);
  }

  async createBid(agentId: string, data: CreateBidRequest): Promise<Bid> {
    const response = await fetch(`${this.baseUrl}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create bid: ${response.statusText}`);
    }

    const json = await response.json();
    return bidSchema.parse(json);
  }

  async getBidsForAsk(askId: string): Promise<Bid[]> {
    const response = await fetch(`${this.baseUrl}/asks/${askId}/bids`);

    if (!response.ok) {
      throw new Error(`Failed to get bids: ${response.statusText}`);
    }

    const json = await response.json();
    return z.array(bidSchema).parse(json);
  }

  async acceptBid(agentId: string, bidId: string): Promise<{ bid: Bid; ask: Ask }> {
    const response = await fetch(`${this.baseUrl}/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId,
      },
      body: JSON.stringify({ bidId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to accept bid: ${response.statusText}`);
    }

    const json = await response.json();
    return z.object({
      bid: bidSchema,
      ask: askSchema,
    }).parse(json);
  }

  async submitDelivery(agentId: string, bidId: string, deliveryProof: Record<string, unknown>): Promise<{ bid: Bid; ask: Ask }> {
    const response = await fetch(`${this.baseUrl}/delivery/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId,
      },
      body: JSON.stringify({ bidId, deliveryProof }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit delivery: ${response.statusText}`);
    }

    const json = await response.json();
    return z.object({
      bid: bidSchema,
      ask: askSchema,
    }).parse(json);
  }
}

// Export a singleton instance
export const tenderingClient = new TenderingClient();
