import { WebSocketServer, WebSocket } from 'ws';
import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { SERVICE_PORTS } from '@harbor/config';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  agentId?: string;
  isAlive?: boolean;
}

export function createWebSocketServer(port: number, _config: Config, logger: Logger) {
  const wss = new WebSocketServer({ port });

  logger.info({ port }, 'WebSocket server starting');

  // Store connections by agent ID for targeted messaging
  const connections = new Map<string, AuthenticatedWebSocket>();

  wss.on('connection', async (ws: AuthenticatedWebSocket) => {
    logger.info('WebSocket connection attempt');

    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle authentication
        if (message.type === 'auth') {
          const { apiKey, agentId } = message;

          // Validate API key
          try {
            const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
            const response = await fetch(`${userServiceUrl}/api-keys/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: apiKey }),
            });

            if (!response.ok) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }));
              ws.close();
              return;
            }

            const data = (await response.json()) as { valid: boolean; userId: string };

            if (!data.valid) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }));
              ws.close();
              return;
            }

            // Store connection
            ws.userId = data.userId;
            ws.agentId = agentId;
            connections.set(agentId, ws);

            ws.send(JSON.stringify({ type: 'authenticated', agentId }));
            logger.info({ userId: data.userId, agentId }, 'WebSocket authenticated');
          } catch (error) {
            logger.error({ error }, 'Auth failed');
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            ws.close();
          }
        }

        // Handle subscription to events
        if (message.type === 'subscribe') {
          // Agent is subscribing to certain events
          ws.send(JSON.stringify({ type: 'subscribed', events: message.events }));
        }
      } catch (error) {
        logger.error({ error }, 'Failed to process WebSocket message');
      }
    });

    ws.on('close', () => {
      if (ws.agentId) {
        connections.delete(ws.agentId);
        logger.info({ agentId: ws.agentId }, 'WebSocket disconnected');
      }
    });
  });

  // Heartbeat to detect broken connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        if (ws.agentId) connections.delete(ws.agentId);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  logger.info({ port }, 'WebSocket server ready');

  // Export function to broadcast events
  return {
    broadcast: (event: { type: string; data: any }) => {
      wss.clients.forEach((client: AuthenticatedWebSocket) => {
        if (client.readyState === WebSocket.OPEN && client.userId) {
          client.send(JSON.stringify(event));
        }
      });
    },
    sendToAgent: (agentId: string, event: { type: string; data: any }) => {
      const ws = connections.get(agentId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
  };
}
