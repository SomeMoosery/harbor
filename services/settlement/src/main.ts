import { serve } from '@hono/node-server';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { createRoutes } from './private/routes/index.js';
import { runMigrations } from './private/store/migrate.js';
import { closeDb } from './private/store/index.js';
import { ensurePlatformWallets } from './private/utils/ensurePlatformWallets.js';

const SERVICE_NAME = 'settlement';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.settlement);
const logger = createLogger({ service: SERVICE_NAME });

async function startServer() {
  logger.info({
    env: config.env,
    port: config.port,
    autoMigrate: config.database.autoMigrate,
  }, 'Starting Settlement service');

  if (config.database.autoMigrate) {
    try {
      await runMigrations(config.env, config.database.url, config.database.useLocalPostgres, logger);
    } catch (error) {
      logger.fatal({ error }, 'Failed to run migrations, shutting down');
      process.exit(1);
    }
  } else {
    logger.info('Auto-migration disabled. Run migrations manually with: pnpm db:migrate');
  }

  // Ensure platform wallets exist for escrow and revenue collection
  try {
    await ensurePlatformWallets(config, logger);
  } catch (error) {
    logger.fatal({ error }, 'Failed to ensure platform wallets exist, shutting down');
    process.exit(1);
  }

  const app = createRoutes(config.env, config.database.url, config.database.useLocalPostgres, logger, config);

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      logger.info(
        {
          url: `http://localhost:${info.port}`,
          env: config.env,
        },
        'Settlement service ready'
      );
    }
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await closeDb(config.env, config.database.useLocalPostgres, logger);
        logger.info('Database connection closed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
