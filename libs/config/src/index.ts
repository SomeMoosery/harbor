import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the monorepo root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const monorepoRoot = join(__dirname, '../../..');

// Load environment variables from monorepo root
config({ path: join(monorepoRoot, '.env') });

import type { Environment } from './environment.js';
import { getEnvironment } from './environment.js';

export interface Config {
  env: Environment;
  nodeEnv: string;
  port: number;

  database: {
    url: string;
    autoMigrate: boolean;
    useLocalPostgres: boolean;
  };

  circle: {
    apiKey: string;
    entitySecret: string;
  };

  stripe: {
    apiKey: string;
    webhookSecret: string;
  };

  providers: {
    useReal: boolean; // Toggle between mock and real providers
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
      useLocalPostgres: process.env.USE_LOCAL_POSTGRES === 'true',
    },

    circle: {
      apiKey: process.env.CIRCLE_API_KEY ?? '',
      entitySecret: process.env.CIRCLE_ENTITY_SECRET ?? '',
    },

    stripe: {
      apiKey: process.env.STRIPE_API_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    },

    providers: {
      useReal: process.env.USE_REAL_PROVIDERS === 'true',
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
