import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { WalletClient } from '@harbor/wallet/client';

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensures a single wallet exists, with retry logic
 */
async function ensureWalletExists(
  walletClient: WalletClient,
  agentId: string,
  logger: Logger,
  maxRetries = 5
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to get the wallet
      await walletClient.getWalletByAgentId(agentId);
      logger.debug({ agentId }, 'Platform wallet already exists');
      return;
    } catch (error) {
      // Wallet doesn't exist, try to create it
      try {
        logger.info({ agentId, attempt }, 'Creating platform wallet');
        await walletClient.createWallet({ agentId });
        logger.info({ agentId }, 'Platform wallet created successfully');
        return;
      } catch (createError) {
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // Exponential backoff: 1s, 2s, 3s, 4s, 5s
          logger.warn(
            {
              agentId,
              attempt,
              maxRetries,
              delay,
              error: createError instanceof Error ? createError.message : String(createError),
            },
            'Failed to create platform wallet, retrying...'
          );
          await sleep(delay);
        } else {
          logger.error(
            {
              agentId,
              error: createError instanceof Error ? createError.message : String(createError),
            },
            'Failed to create platform wallet after all retries'
          );
          throw createError;
        }
      }
    }
  }
}

/**
 * Ensures platform wallets exist for escrow and revenue collection
 * Creates them if they don't already exist
 * Includes retry logic to handle race conditions during startup
 */
export async function ensurePlatformWallets(config: Config, logger: Logger): Promise<void> {
  const walletClient = new WalletClient();

  logger.info('Ensuring platform wallets exist');

  try {
    // Ensure escrow wallet exists
    await ensureWalletExists(walletClient, config.wallets.escrowAgentId, logger);

    // Ensure revenue wallet exists
    await ensureWalletExists(walletClient, config.wallets.revenueAgentId, logger);

    logger.info('Platform wallets verified successfully');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Failed to ensure platform wallets exist'
    );
    throw error;
  }
}
