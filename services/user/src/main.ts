import { serve } from '@hono/node-server';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { createRoutes } from './private/routes/index.js';
import { runUserMigrations } from './private/store/migrate.js';
import { closeDb } from './private/store/index.js';

const SERVICE_NAME = 'user';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.user);
const logger = createLogger({ service: SERVICE_NAME });

async function startServer() {
  logger.info({
    env: config.env,
    port: config.port,
    autoMigrate: config.database.autoMigrate,
  }, 'Starting User service');

  // Run migrations if configured (auto in local, manual in staging/prod)
  if (config.database.autoMigrate) {
    try {
      await runUserMigrations(config.database.url, logger);
    } catch (error) {
      logger.fatal({
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to run migrations, shutting down');
      process.exit(1);
    }
  } else {
    logger.info('Auto-migration disabled. Run migrations manually with: pnpm db:migrate');
  }

  // Create routes
  const app = createRoutes(config.database.url, logger);

  // Start HTTP server
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
        'User service ready'
      );
    }
  );

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await closeDb(logger);
        logger.info('Database connection closed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the server
startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
