import type { Logger } from '@harbor/logger';
import type { WalletProvider } from './walletProvider.js';
import type { Money } from '../../public/model/money.js';
import { toDecimalString, fromDecimalString } from '../../public/model/money.js';
import { WalletResource } from '../resources/wallet.resource.js';
import { Wallet } from '../../public/model/wallet.js';
import { randomUUID } from 'crypto';
import {
  initiateDeveloperControlledWalletsClient,
  generateEntitySecretCiphertext
} from '@circle-fin/developer-controlled-wallets';
import type { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

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
  private client: CircleDeveloperControlledWalletsClient;
  private apiKey: string;
  private entitySecret: string;
  private isTestnet: boolean;
  private readonly walletResource: WalletResource;

  constructor(
    private logger: Logger,
    config: {
      apiKey: string;
      entitySecret: string; // Raw entity secret for SDK client initialization
      isTestnet?: boolean;
    },
    walletResource: WalletResource
  ) {
    this.apiKey = config.apiKey;
    this.entitySecret = config.entitySecret;
    this.isTestnet = config.isTestnet || true;
    this.walletResource = walletResource;

    // Initialize Circle SDK client - handles entity secret encryption automatically
    // Force production URL since TEST_API_KEY works with production, not sandbox
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: config.apiKey,
      entitySecret: config.entitySecret,
      baseUrl: 'https://api.circle.com',
    });
  }

  async createWallet(agentId: string): Promise<{ walletId: string; walletAddress: string }> {
    this.logger.info({ agentId }, 'Creating Circle wallet');

    try {
      // Create wallet set for this agent
      this.logger.debug({ agentId }, 'Creating wallet set');
      const walletSetResponse = await this.client.createWalletSet({
        idempotencyKey: agentId,
        name: `${agentId} Wallet Set`,
      });

      if (!walletSetResponse.data?.walletSet?.id) {
        throw new Error('Failed to get wallet set ID from Circle response');
      }

      const walletSetId = walletSetResponse.data.walletSet.id;
      this.logger.info({ agentId, walletSetId }, 'Wallet set created');

      // Create wallet in the wallet set
      this.logger.debug({ agentId, walletSetId }, 'Creating wallet');
      const walletResponse = await this.client.createWallets({
        idempotencyKey: agentId,
        accountType: 'SCA',
        blockchains: ['ETH-SEPOLIA'], // Use Sepolia testnet
        count: 1,
        walletSetId: walletSetId,
      });

      const wallets = walletResponse.data?.wallets;

      if (!wallets || wallets.length === 0) {
        throw new Error('No wallets returned from Circle');
      }

      const wallet = wallets[0];
      if (!wallet || !wallet.id || !wallet.address) {
        throw new Error('Invalid wallet data returned from Circle');
      }

      const walletId = wallet.id;
      const walletAddress = wallet.address;

      this.logger.info(
        { agentId, walletId, walletAddress, blockchain: 'ETH-SEPOLIA' },
        'Circle wallet created successfully'
      );

      // Return wallet ID and address
      return { walletId, walletAddress };
    } catch (error: any) {
      // Log detailed error information including Circle's response
      const errorDetails: any = {
        error,
        agentId,
        circleResponse: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
      };
      this.logger.error(errorDetails, 'Failed to create Circle wallet');
      throw error;
    }
  }

  async getBalance(walletId: string): Promise<Money> {
    this.logger.debug({ walletId }, 'Getting Circle wallet balance');

    try {
      const response = await this.client.getWalletTokenBalance({ id: walletId });

      // Find USDC balance
      const usdcBalance = response.data?.tokenBalances?.find(
        (balance: any) => balance.token.symbol === 'USDC'
      );

      if (!usdcBalance) {
        return { amount: 0, currency: 'USDC' };
      }

      // Convert from decimal string to Money
      return fromDecimalString(usdcBalance.amount, 'USDC');
    } catch (error) {
      this.logger.error({ error, walletId }, 'Failed to get Circle wallet balance');
      throw error;
    }
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    this.logger.info({ fromWalletId, toWalletId, amount }, 'Initiating Circle wallet transfer');

    try {
      // Note: Using direct API call for wallet-to-wallet transfers.
      // The SDK's createTransaction is designed for outbound blockchain transactions.
      // The /v1/w3s/developer/transactions/transfer endpoint is specific to internal wallet transfers.

      // Generate fresh entity secret ciphertext for this operation
      const entitySecretCiphertext = await generateEntitySecretCiphertext({
        apiKey: this.apiKey,
        entitySecret: this.entitySecret,
      });

      const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          entitySecretCiphertext,
          sourceWalletId: fromWalletId,
          destinationWalletId: toWalletId,
          amounts: [toDecimalString(amount)],
          tokenId: process.env.CIRCLE_USDC_TOKEN_ID || 'USDC',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to transfer via Circle: ${error}`);
      }

      const data = await response.json() as any;
      const transactionId = data.data?.id;

      if (!transactionId) {
        throw new Error('Failed to get transaction ID from Circle response');
      }

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
        this.client.getWallet({ id: walletId }),
        this.getBalance(walletId),
      ]);

      return {
        id: walletId,
        balance,
        status: walletResponse.data?.wallet?.state || 'ACTIVE',
      };
    } catch (error) {
      this.logger.error({ error, walletId }, 'Failed to get Circle wallet details');
      throw error;
    }
  }

  async fundWallet(toWalletId: string, amount: Money): Promise<Money> {
    if (!this.isTestnet) {
      throw new Error('[NOT IMPLEMENTED] Funding wallets on mainnet is not yet implemented. Use testnet environment.');
    }

    this.logger.info({ toWalletId, amount }, 'Funding wallet with testnet tokens');

    try {
      // Get wallet address from wallet ID
      const wallet: Wallet = await this.walletResource.findById(toWalletId);

      if (!wallet.walletAddress) {
        throw new Error(`Wallet ${toWalletId} does not have an address stored`);
      }

      // Request testnet USDC tokens from Circle SDK
      await this.client.requestTestnetTokens({
        address: wallet.walletAddress,
        blockchain: 'ETH-SEPOLIA',
        usdc: true,
        native: false,
        eurc: false,
      });

      this.logger.info(
        { toWalletId, walletAddress: wallet.walletAddress, amount },
        'Successfully requested testnet tokens from Circle faucet'
      );

      return amount;
    } catch (error) {
      this.logger.error({ error, toWalletId }, 'Failed to fund wallet with testnet tokens');
      throw error;
    }
  }
}
