import { serve } from '@hono/node-server';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { createHttpRoutes } from './private/routes/http.js';
import { createWebSocketServer } from './private/websocket/server.js';

const SERVICE_NAME = 'gateway';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.gateway || 3000);
const logger = createLogger({ service: SERVICE_NAME });

async function startServer() {
  logger.info({
    env: config.env,
    port: config.port,
  }, 'Starting Gateway service');

  // Start WebSocket server first so we can pass it to HTTP routes
  const wsPort = SERVICE_PORTS.gatewayWs;
  const wsServer = createWebSocketServer(wsPort, config, logger);

  // Create HTTP routes with WebSocket server reference
  const app = createHttpRoutes(config, logger, wsServer);

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
        'Gateway HTTP server ready'
      );
    }
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
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
