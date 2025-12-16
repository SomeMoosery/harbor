import type { Logger } from '@harbor/logger';
import type { WalletProvider } from './walletProvider.js';
import type { Money } from '../../public/model/money.js';

/**
 * Circle wallet provider implementation
 *
 * This provider integrates with Circle's API for wallet management.
 * For local/testing: Uses Circle testnet
 * For production: Uses Circle mainnet
 *
 * Note: Circle MCP server can be used here if available.
 * The MCP server would provide tools for wallet operations.
 */
export class CircleWalletProvider implements WalletProvider {
  private apiKey: string;
  private entitySecret: string;
  private baseUrl: string;

  constructor(
    private logger: Logger,
    config: {
      apiKey: string;
      entitySecret: string;
      isTestnet?: boolean;
    }
  ) {
    this.apiKey = config.apiKey;
    this.entitySecret = config.entitySecret;
    this.baseUrl = config.isTestnet
      ? 'https://api-sandbox.circle.com'
      : 'https://api.circle.com';
  }

  async createWallet(agentId: string): Promise<string> {
    this.logger.info({ agentId }, 'Creating Circle wallet');

    try {
      // TODO: Integrate with Circle MCP server if available
      // For now, using direct Circle API calls

      const response = await fetch(`${this.baseUrl}/v1/w3s/developer/wallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: `wallet-${agentId}-${Date.now()}`,
          entitySecretCiphertext: this.entitySecret,
          walletSetId: process.env.CIRCLE_WALLET_SET_ID || 'default',
          metadata: {
            agentId,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create Circle wallet: ${error}`);
      }

      const data = await response.json();
      const walletId = data.data.walletId;

      this.logger.info({ agentId, walletId }, 'Circle wallet created successfully');
      return walletId;
    } catch (error) {
      this.logger.error({ error, agentId }, 'Failed to create Circle wallet');
      throw error;
    }
  }

  async getBalance(walletId: string): Promise<Money> {
    this.logger.debug({ walletId }, 'Getting Circle wallet balance');

    try {
      const response = await fetch(`${this.baseUrl}/v1/w3s/wallets/${walletId}/balances`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Circle wallet balance: ${error}`);
      }

      const data = await response.json();

      // Find USDC balance
      const usdcBalance = data.data.tokenBalances.find(
        (balance: any) => balance.token.symbol === 'USDC'
      );

      const amount = usdcBalance ? parseFloat(usdcBalance.amount) : 0;

      return {
        amount,
        currency: 'USDC',
      };
    } catch (error) {
      this.logger.error({ error, walletId }, 'Failed to get Circle wallet balance');
      throw error;
    }
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    this.logger.info({ fromWalletId, toWalletId, amount }, 'Initiating Circle wallet transfer');

    try {
      const response = await fetch(`${this.baseUrl}/v1/w3s/developer/transactions/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: `transfer-${fromWalletId}-${toWalletId}-${Date.now()}`,
          entitySecretCiphertext: this.entitySecret,
          sourceWalletId: fromWalletId,
          destinationWalletId: toWalletId,
          amounts: [`${amount.amount}`],
          tokenId: process.env.CIRCLE_USDC_TOKEN_ID || 'USDC',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to transfer via Circle: ${error}`);
      }

      const data = await response.json();
      const transactionId = data.data.id;

      this.logger.info({ fromWalletId, toWalletId, transactionId }, 'Circle transfer initiated');
      return transactionId;
    } catch (error) {
      this.logger.error({ error, fromWalletId, toWalletId }, 'Failed to transfer via Circle');
      throw error;
    }
  }

  async getWallet(walletId: string): Promise<{ id: string; balance: Money; status: string }> {
    this.logger.debug({ walletId }, 'Getting Circle wallet details');

    try {
      const [walletResponse, balance] = await Promise.all([
        fetch(`${this.baseUrl}/v1/w3s/wallets/${walletId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }),
        this.getBalance(walletId),
      ]);

      if (!walletResponse.ok) {
        const error = await walletResponse.text();
        throw new Error(`Failed to get Circle wallet: ${error}`);
      }

      const walletData = await walletResponse.json();

      return {
        id: walletId,
        balance,
        status: walletData.data.state || 'ACTIVE',
      };
    } catch (error) {
      this.logger.error({ error, walletId }, 'Failed to get Circle wallet details');
      throw error;
    }
  }
}
