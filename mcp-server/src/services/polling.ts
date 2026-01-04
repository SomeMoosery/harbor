/**
 * Bid polling service
 * Automatically polls for new bids and notifies when bid window closes
 */

import type { HarborClient } from './harbor-client.js';
import type { Ask, Bid } from '../types/harbor.js';
import { logger } from '../utils/logger.js';

export type BidsUpdateCallback = (bids: Bid[], ask: Ask) => void;
export type WindowClosedCallback = (ask: Ask, bids: Bid[]) => void;

export class BidPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds
  private currentAskId: string | null = null;

  constructor(private client: HarborClient) {}

  /**
   * Start polling for bids on a specific ask
   */
  async startPolling(
    askId: string,
    onBidsUpdate: BidsUpdateCallback,
    onWindowClosed: WindowClosedCallback
  ): Promise<void> {
    // Stop any existing polling
    this.stopPolling();

    this.currentAskId = askId;
    logger.info('Starting bid polling', { askId, intervalMs: this.POLL_INTERVAL_MS });

    // Do an immediate poll
    await this.poll(askId, onBidsUpdate, onWindowClosed);

    // Only set up interval polling if polling wasn't stopped during the initial poll
    // (poll might have called stopPolling if window was already closed)
    if (this.currentAskId !== null) {
      this.intervalId = setInterval(async () => {
        await this.poll(askId, onBidsUpdate, onWindowClosed);
      }, this.POLL_INTERVAL_MS);
    }
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.currentAskId) {
      logger.info('Stopping bid polling', { askId: this.currentAskId });
      this.currentAskId = null;
    }
  }

  /**
   * Check if currently polling
   */
  isPolling(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the current ask being polled
   */
  getCurrentAskId(): string | null {
    return this.currentAskId;
  }

  /**
   * Perform a single poll
   */
  private async poll(
    askId: string,
    onBidsUpdate: BidsUpdateCallback,
    onWindowClosed: WindowClosedCallback
  ): Promise<void> {
    try {
      // Fetch ask details
      const ask = await this.client.getAsk(askId);

      // Fetch current bids
      const bids = await this.client.getBidsForAsk(askId);

      logger.debug('Poll completed', {
        askId,
        status: ask.status,
        bidCount: bids.length,
        bidWindowClosesAt: ask.bidWindowClosesAt,
      });

      // Notify about bid updates
      onBidsUpdate(bids, ask);

      // Check if bid window has closed
      const now = new Date();
      const windowClosesAt = new Date(ask.bidWindowClosesAt);

      if (ask.status !== 'OPEN' || windowClosesAt <= now) {
        logger.info('Bid window closed', { askId, finalBidCount: bids.length });
        this.stopPolling();
        onWindowClosed(ask, bids);
      }
    } catch (error) {
      logger.error('Polling error', { askId, error });
      // Continue polling despite errors - don't stop on transient failures
    }
  }
}
