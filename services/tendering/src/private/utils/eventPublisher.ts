import type { Logger } from '@harbor/logger';
import { SERVICE_PORTS } from '@harbor/config';

/**
 * Event publisher that sends events to the gateway WebSocket server
 */
export class EventPublisher {
  private gatewayWsUrl: string;

  constructor(private readonly logger: Logger) {
    // In a real implementation, this would connect to the gateway's WebSocket server
    // For now, we'll use HTTP to notify the gateway, which will then broadcast via WebSocket
    this.gatewayWsUrl = `http://localhost:${SERVICE_PORTS.gateway}`;
  }

  async publishAskCreated(data: {
    askId: string;
    agentId: string;
    description: string;
    maxPrice: number;
    currency: string;
    expiresAt: string;
  }): Promise<void> {
    await this.publishEvent('ask_created', data);
  }

  async publishBidCreated(data: {
    bidId: string;
    askId: string;
    agentId: string;
    price: number;
    currency: string;
    expiresAt: string;
  }): Promise<void> {
    await this.publishEvent('bid_created', data);
  }

  async publishBidAccepted(data: {
    bidId: string;
    askId: string;
    contractId: string;
  }): Promise<void> {
    await this.publishEvent('bid_accepted', data);
  }

  async publishDeliverySubmitted(data: {
    contractId: string;
    deliveryData: any;
  }): Promise<void> {
    await this.publishEvent('delivery_submitted', data);
  }

  private async publishEvent(type: string, data: any, targetAgentId?: string): Promise<void> {
    try {
      this.logger.info({ type, data, targetAgentId }, 'Publishing event');

      await fetch(`${this.gatewayWsUrl}/internal/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, targetAgentId }),
      });
    } catch (error) {
      this.logger.error({ error, type, data }, 'Failed to publish event');
      // Don't throw - event publishing failures shouldn't break the main flow
    }
  }
}
