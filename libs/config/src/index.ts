import { config } from 'dotenv';

// Load environment variables
config();

export interface Config {
  env: 'development' | 'production' | 'test';
  nodeEnv: string;
  port: number;

  database: {
    url: string;
  };

  circle: {
    apiKey: string;
    entitySecret: string;
  };
}

export function createConfig(serviceName: string, defaultPort: number): Config {
  return {
    env: (process.env.NODE_ENV as Config['env']) ?? 'development',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? String(defaultPort), 10),

    database: {
      url: process.env[`DATABASE_URL_${serviceName.toUpperCase()}`] ?? process.env.DATABASE_URL ?? '',
    },

    circle: {
      apiKey: process.env.CIRCLE_API_KEY ?? '',
      entitySecret: process.env.CIRCLE_ENTITY_SECRET ?? '',
    },
  };
}

export * from './ports.js';
