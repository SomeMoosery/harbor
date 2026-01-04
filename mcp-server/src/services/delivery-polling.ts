/**
 * Delivery polling service
 * Polls ask status until delivery is complete
 */

import type { HarborClient } from './harbor-client.js';
import type { Ask } from '../types/harbor.js';
import { logger } from '../utils/logger.js';

export type DeliveryCompleteCallback = (ask: Ask, deliveryData: Record<string, unknown>) => void;
export type DeliveryTimeoutCallback = (ask: Ask) => void;

export class DeliveryPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds
  private currentAskId: string | null = null;
  private startTime: number = 0;

  constructor(private client: HarborClient) {}

  /**
   * Start polling for delivery completion
   */
  async startPolling(
    askId: string,
    onDeliveryComplete: DeliveryCompleteCallback,
    onTimeout?: DeliveryTimeoutCallback,
    timeoutMs?: number
  ): Promise<void> {
    // Stop any existing polling
    this.stopPolling();

    this.currentAskId = askId;
    this.startTime = Date.now();
    logger.info('Starting delivery polling', {
      askId,
      intervalMs: this.POLL_INTERVAL_MS,
      timeoutMs,
    });

    // Do an immediate poll
    await this.poll(askId, onDeliveryComplete, onTimeout, timeoutMs);

    // Only set up interval polling if polling wasn't stopped during the initial poll
    // (poll might have called stopPolling if delivery was already complete)
    if (this.currentAskId !== null) {
      this.intervalId = setInterval(async () => {
        await this.poll(askId, onDeliveryComplete, onTimeout, timeoutMs);
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
      logger.info('Stopping delivery polling', { askId: this.currentAskId });
      this.currentAskId = null;
      this.startTime = 0;
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
    onDeliveryComplete: DeliveryCompleteCallback,
    onTimeout?: DeliveryTimeoutCallback,
    timeoutMs?: number
  ): Promise<void> {
    try {
      // Fetch ask details
      const ask = await this.client.getAsk(askId);

      logger.debug('Delivery poll completed', {
        askId,
        status: ask.status,
        hasDeliveryData: !!ask.deliveryData,
      });

      // Check for timeout
      if (timeoutMs && Date.now() - this.startTime > timeoutMs) {
        logger.warn('Delivery polling timed out', {
          askId,
          elapsedMs: Date.now() - this.startTime,
          timeoutMs,
        });
        this.stopPolling();
        if (onTimeout) {
          onTimeout(ask);
        }
        return;
      }

      // Check if delivery is complete
      if (ask.status === 'COMPLETED' && ask.deliveryData) {
        logger.info('Delivery completed!', {
          askId,
          deliveryDataKeys: Object.keys(ask.deliveryData),
        });
        this.stopPolling();
        onDeliveryComplete(ask, ask.deliveryData);
        return;
      }

      // Log progress
      logger.debug('Delivery still pending', {
        askId,
        status: ask.status,
        elapsedMs: Date.now() - this.startTime,
      });
    } catch (error) {
      logger.error('Delivery polling error', { askId, error });
      // Continue polling despite errors - don't stop on transient failures
    }
  }
}
