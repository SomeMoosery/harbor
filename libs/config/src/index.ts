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
    escrowAgentId: string; // Platform agent ID for escrow wallet
    revenueAgentId: string; // Platform agent ID for revenue wallet
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
      // Well-known UUIDs for platform agents
      // These are deterministic so platform wallets remain consistent across restarts
      escrowAgentId: process.env.ESCROW_AGENT_ID ?? '00000000-0000-0000-0000-000000000001',
      revenueAgentId: process.env.REVENUE_AGENT_ID ?? '00000000-0000-0000-0000-000000000002',
    },
  };
}

export * from './ports.js';
export * from './environment.js';
