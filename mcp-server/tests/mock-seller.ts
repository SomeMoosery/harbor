#!/usr/bin/env node

/**
 * Mock Seller Agent
 * Automatically creates bids and submits deliveries for testing
 */

import { HarborClient } from '../src/services/harbor-client.js';

interface MockSellerConfig {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  autoCreateBids: boolean;
  autoSubmitDelivery: boolean;
  deliveryDelayMs: number;
}

class MockSeller {
  private client: HarborClient;
  private monitoredAsks = new Set<string>();
  private acceptedBids = new Set<string>();

  constructor(private config: MockSellerConfig) {
    this.client = new HarborClient(config.baseUrl, config.apiKey);
  }

  /**
   * Start monitoring for new asks and automatically bid
   */
  async startMonitoring(): Promise<void> {
    console.log('[MockSeller] Starting monitoring...');
    console.log(`[MockSeller] Config:`, {
      baseUrl: this.config.baseUrl,
      agentId: this.config.agentId,
      autoCreateBids: this.config.autoCreateBids,
      autoSubmitDelivery: this.config.autoSubmitDelivery,
      deliveryDelayMs: this.config.deliveryDelayMs,
    });

    // Poll for new asks every 5 seconds
    setInterval(async () => {
      await this.checkForNewAsks();
    }, 5000);

    // Check for accepted bids every 10 seconds
    setInterval(async () => {
      await this.checkForAcceptedBids();
    }, 10000);
  }

  /**
   * Check for new asks and create bids
   */
  private async checkForNewAsks(): Promise<void> {
    try {
      // This would need a GET /asks endpoint that lists all asks
      // For now, we'll skip auto-detection and rely on manual bid creation
      // TODO: Implement when Harbor has a list asks endpoint
    } catch (error) {
      console.error('[MockSeller] Error checking for asks:', error);
    }
  }

  /**
   * Check for accepted bids and submit deliveries
   */
  private async checkForAcceptedBids(): Promise<void> {
    try {
      // This would need to check bid status
      // For now, we'll rely on manual triggering
      // TODO: Implement when we can query our own bids
    } catch (error) {
      console.error('[MockSeller] Error checking for accepted bids:', error);
    }
  }

  /**
   * Manually create a bid for a specific ask
   */
  async createBid(askId: string, options?: {
    price?: number;
    estimatedHours?: number;
    proposal?: string;
  }): Promise<void> {
    try {
      console.log(`[MockSeller] Creating bid for ask ${askId}...`);

      const response = await fetch(`${this.config.baseUrl}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.config.agentId,
        },
        body: JSON.stringify({
          askId,
          price: options?.price || 15,
          estimatedHours: options?.estimatedHours || 2,
          proposal: options?.proposal || 'I can help you with this task. I have experience with similar projects.',
          availability: 'Available now',
        }),
      });

      const bid = await response.json();
      console.log(`[MockSeller] Bid created:`, bid);

      this.monitoredAsks.add(askId);
    } catch (error) {
      console.error(`[MockSeller] Error creating bid:`, error);
    }
  }

  /**
   * Manually submit delivery for a bid
   */
  async submitDelivery(bidId: string, deliveryData?: Record<string, unknown>): Promise<void> {
    try {
      console.log(`[MockSeller] Submitting delivery for bid ${bidId}...`);

      const defaultDelivery = {
        code: {
          'fibonacci.py': `def fibonacci(n):
    """Calculate fibonacci number using memoization"""
    memo = {}
    def fib(n):
        if n in memo:
            return memo[n]
        if n <= 1:
            return n
        memo[n] = fib(n-1) + fib(n-2)
        return memo[n]
    return fib(n)

# Example usage
print(fibonacci(10))  # Output: 55`,
        },
        documentation: 'I implemented a fibonacci function with memoization for optimal performance. The function handles edge cases and includes example usage.',
        notes: 'Tested with various inputs. Time complexity: O(n), Space complexity: O(n)',
      };

      const response = await fetch(`${this.config.baseUrl}/delivery/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.config.agentId,
        },
        body: JSON.stringify({
          bidId,
          deliveryProof: deliveryData || defaultDelivery,
        }),
      });

      const result = await response.json();
      console.log(`[MockSeller] Delivery submitted:`, result);
    } catch (error) {
      console.error(`[MockSeller] Error submitting delivery:`, error);
    }
  }
}

// CLI Usage
async function main() {
  const apiKey = process.env.HARBOR_SELLER_API_KEY || process.env.HARBOR_API_KEY;
  const baseUrl = process.env.HARBOR_BASE_URL || 'http://localhost:3000';
  const agentId = process.env.HARBOR_SELLER_AGENT_ID || 'seller-agent-1';

  if (!apiKey) {
    console.error('Error: HARBOR_SELLER_API_KEY or HARBOR_API_KEY environment variable required');
    process.exit(1);
  }

  const mockSeller = new MockSeller({
    apiKey,
    baseUrl,
    agentId,
    autoCreateBids: false, // Manual for now
    autoSubmitDelivery: false, // Manual for now
    deliveryDelayMs: 30000, // 30 seconds
  });

  // Parse command line arguments
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case 'monitor':
      await mockSeller.startMonitoring();
      break;

    case 'bid':
      if (!arg1) {
        console.error('Usage: mock-seller bid <askId> [price]');
        process.exit(1);
      }
      await mockSeller.createBid(arg1, { price: arg2 ? parseFloat(arg2) : undefined });
      break;

    case 'deliver':
      if (!arg1) {
        console.error('Usage: mock-seller deliver <bidId>');
        process.exit(1);
      }
      await mockSeller.submitDelivery(arg1);
      break;

    default:
      console.log('Mock Seller Agent for Testing');
      console.log('');
      console.log('Usage:');
      console.log('  mock-seller monitor          Start monitoring (future)');
      console.log('  mock-seller bid <askId> [price]     Create a bid for an ask');
      console.log('  mock-seller deliver <bidId>  Submit delivery for a bid');
      console.log('');
      console.log('Environment variables:');
      console.log('  HARBOR_SELLER_API_KEY or HARBOR_API_KEY - API key for seller agent');
      console.log('  HARBOR_BASE_URL - Base URL (default: http://localhost:3000)');
      console.log('  HARBOR_SELLER_AGENT_ID - Agent ID (default: seller-agent-1)');
      break;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
