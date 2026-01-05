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
      entitySecret: string;
      isTestnet?: boolean;
    },
    walletResource: WalletResource
  ) {
    this.apiKey = config.apiKey;
    this.entitySecret = config.entitySecret;
    this.isTestnet = config.isTestnet || true;
    this.walletResource = walletResource;

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
        blockchains: ['BASE-SEPOLIA'],
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
        { agentId, walletId, walletAddress, blockchain: 'BASE-SEPOLIA	' },
        'Circle wallet created successfully'
      );

      // Return wallet ID and address
      return { walletId, walletAddress };
    } catch (error: any) {
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

      return fromDecimalString(usdcBalance.amount, 'USDC');
    } catch (error) {
      this.logger.error({ error, walletId }, 'Failed to get Circle wallet balance');
      throw error;
    }
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    this.logger.info({ fromWalletId, toWalletId, amount }, 'Initiating Circle wallet transfer');

    try {
      // Get the blockchain address of the destination wallet
      const toWallet = await this.walletResource.findById(toWalletId);
      if (!toWallet.walletAddress) {
        throw new Error(`Destination wallet ${toWalletId} does not have a blockchain address`);
      }

      const tokenId = process.env.CIRCLE_USDC_TOKEN_ID;
      if (!tokenId) {
        throw new Error('CIRCLE_USDC_TOKEN_ID environment variable is not set');
      }

      // Use the Circle SDK to create a transaction
      const response = await this.client.createTransaction({
        walletId: fromWalletId,
        tokenId: tokenId,
        destinationAddress: toWallet.walletAddress,
        amount: [toDecimalString(amount)],
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM',
          },
        },
      });

      const transactionId = response.data?.id;
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
      // TODO is there a way to request >1 or just specify an amount?
      await this.client.requestTestnetTokens({
        address: wallet.walletAddress,
        blockchain: 'BASE-SEPOLIA',
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
