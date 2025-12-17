import { config } from 'dotenv';

// Load environment variables
config();

import type { Environment } from './environment.js';
import { getEnvironment } from './environment.js';

export interface Config {
  env: Environment;
  nodeEnv: string;
  port: number;

  database: {
    url: string;
    autoMigrate: boolean;
  };

  circle: {
    apiKey: string;
    entitySecret: string;
  };

  stripe: {
    apiKey: string;
  };

  fees: {
    buyerPercentage: number; // e.g., 0.025 for 2.5%
    sellerPercentage: number; // e.g., 0.025 for 2.5%
  };

  wallets: {
    escrowWalletId: string; // Platform omnibus wallet for holding escrow funds
    revenueWalletId: string; // Platform wallet for collecting fees
  };
}

export function createConfig(serviceName: string, defaultPort: number): Config {
  const env = getEnvironment();

  return {
    env,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? String(defaultPort), 10),

    database: {
      url: process.env[`DATABASE_URL_${serviceName.toUpperCase()}`] ?? process.env.DATABASE_URL ?? '',
      // Auto-migrate in local by default, configurable via env var
      autoMigrate: process.env.DB_AUTO_MIGRATE === 'true' || (env === 'local' && process.env.DB_AUTO_MIGRATE !== 'false'),
    },

    circle: {
      apiKey: process.env.CIRCLE_API_KEY ?? '',
      entitySecret: process.env.CIRCLE_ENTITY_SECRET ?? '',
    },

    stripe: {
      apiKey: process.env.STRIPE_API_KEY ?? '',
    },

    fees: {
      buyerPercentage: parseFloat(process.env.FEE_BUYER_PERCENTAGE ?? '0.025'), // Default 2.5%
      sellerPercentage: parseFloat(process.env.FEE_SELLER_PERCENTAGE ?? '0.025'), // Default 2.5%
    },

    wallets: {
      escrowWalletId: process.env.ESCROW_WALLET_ID ?? '',
      revenueWalletId: process.env.REVENUE_WALLET_ID ?? '',
    },
  };
}

export * from './ports.js';
export * from './environment.js';
