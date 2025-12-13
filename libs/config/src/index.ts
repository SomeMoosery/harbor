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
  };
}

export * from './ports.js';
export * from './environment.js';
