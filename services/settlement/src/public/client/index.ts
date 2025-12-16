import { getServiceUrl } from '@harbor/config/ports';
import type { LockEscrowRequest } from '../request/lockEscrowRequest.js';
import type { ReleaseEscrowRequest } from '../request/releaseEscrowRequest.js';
import type { EscrowLock } from '../model/escrowLock.js';
import type { Settlement } from '../model/settlement.js';

export class SettlementClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('settlement');
  }

  async lockEscrow(data: LockEscrowRequest): Promise<EscrowLock> {
    const response = await fetch(`${this.baseUrl}/escrow/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to lock escrow: ${error}`);
    }

    return await response.json();
  }

  async releaseEscrow(data: ReleaseEscrowRequest): Promise<Settlement> {
    const response = await fetch(`${this.baseUrl}/escrow/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to release escrow: ${error}`);
    }

    return await response.json();
  }

  async getEscrowLock(id: string): Promise<EscrowLock> {
    const response = await fetch(`${this.baseUrl}/escrow/${id}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get escrow lock: ${error}`);
    }

    return await response.json();
  }

  async getEscrowLockByBidId(bidId: string): Promise<EscrowLock | null> {
    const response = await fetch(`${this.baseUrl}/escrow/bid/${bidId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get escrow lock: ${error}`);
    }

    return await response.json();
  }

  async getSettlement(id: string): Promise<Settlement> {
    const response = await fetch(`${this.baseUrl}/settlements/${id}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get settlement: ${error}`);
    }

    return await response.json();
  }
}

export const settlementClient = new SettlementClient();
