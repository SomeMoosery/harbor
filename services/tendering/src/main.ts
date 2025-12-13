import { serve } from '@hono/node-server';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { createRoutes } from './private/routes/index.js';

const SERVICE_NAME = 'tendering';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.tendering);
const logger = createLogger({ service: SERVICE_NAME });

const app = createRoutes(config.database.url, logger);

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info(`Tendering service listening on http://localhost:${info.port}`);
  }
);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
