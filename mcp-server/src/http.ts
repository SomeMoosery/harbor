#!/usr/bin/env node

/**
 * Harbor MCP Server - HTTP Transport
 * Exposes the MCP server over HTTP for registration with Claude Code
 * Requires authentication via Authorization header
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

import { logger } from './utils/logger.js';
import { createMcpServer, ServerContext } from './server.js';
import { HarborClient } from './services/harbor-client.js';
import { BidPollingService } from './services/polling.js';
import { DeliveryPollingService } from './services/delivery-polling.js';
import { loadConfig } from './config.js';
import { waitForServiceHealth } from '@harbor/config';

// Load environment variables
const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

const DEFAULT_PORT = 3006;

// Store authenticated contexts per session
const sessionContexts = new Map<string, ServerContext>();
const transports = new Map<string, StreamableHTTPServerTransport>();
const oauthClients = new Map<string, { clientSecret: string }>();
const oauthCodes = new Map<string, { apiKey: string }>();
const oauthTokens = new Map<string, { apiKey: string }>();

/**
 * Extract API key from Authorization header
 */
function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    const token = parts[1];
    if (token.startsWith('hbr_')) {
      return token;
    }
    const mapped = oauthTokens.get(token);
    if (mapped) {
      return mapped.apiKey;
    }
    return token;
  }
  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

/**
 * Initialize server context for a given API key
 */
async function initializeContextForApiKey(apiKey: string): Promise<ServerContext> {
  const config = loadConfig({ requireApiKey: false });

  // Wait for required services to be healthy
  logger.info('Waiting for required services to be healthy...');
  await waitForServiceHealth('gateway', { maxRetries: 30, initialDelay: 1000 });
  await waitForServiceHealth('user', { maxRetries: 30, initialDelay: 1000 });
  logger.info('All required services are healthy');

  // Initialize Harbor client with the provided API key
  const harborClient = new HarborClient(config.harborBaseUrl);

  // Authenticate using the API key from header
  const { initializeAuthentication } = await import('./tools/authenticate.js');
  await initializeAuthentication(harborClient, apiKey);
  logger.info('Authentication successful for new session');

  // Initialize polling services
  const bidPollingService = new BidPollingService(harborClient);
  const deliveryPollingService = new DeliveryPollingService(harborClient);

  return {
    harborClient,
    bidPollingService,
    deliveryPollingService,
  };
}

async function startHttpServer() {
  const port = parseInt(process.env.MCP_HTTP_PORT || String(DEFAULT_PORT), 10);

  logger.info('Starting Harbor MCP Server (HTTP transport)', { port });

  // Create Express app
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Health check endpoint (no auth required)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'harbor-mcp-server',
      transport: 'http',
      version: '0.1.0',
    });
  });

  // OAuth metadata endpoint used by some MCP clients.
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const issuer = `http://127.0.0.1:${port}`;
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
    });
  });

  // OAuth dynamic client registration (minimal, in-memory).
  app.post('/register', (req, res) => {
    const clientId = `mcp_${randomUUID()}`;
    const clientSecret = randomUUID();
    oauthClients.set(clientId, { clientSecret });

    const redirectUris = Array.isArray(req.body?.redirect_uris) ? req.body.redirect_uris : [];
    const responseTypes = Array.isArray(req.body?.response_types) ? req.body.response_types : ['code'];
    const grantTypes = Array.isArray(req.body?.grant_types)
      ? req.body.grant_types
      : ['authorization_code', 'client_credentials', 'refresh_token'];

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'client_secret_post',
      redirect_uris: redirectUris,
      response_types: responseTypes,
      grant_types: grantTypes,
    });
  });

  // OAuth authorize endpoint (auto-approves and redirects with code).
  app.get('/authorize', (req, res) => {
    const { redirect_uri, state } = req.query as { redirect_uri?: string; state?: string };
    const apiKey =
      extractApiKey(req.headers.authorization) || process.env.HARBOR_API_KEY || null;

    if (!redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing redirect_uri',
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing Authorization header or HARBOR_API_KEY',
      });
    }

    const code = `mcp_code_${randomUUID()}`;
    oauthCodes.set(code, { apiKey });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    res.redirect(302, redirectUrl.toString());
  });

  // OAuth token endpoint (supports client_credentials, authorization_code, refresh_token).
  app.post('/token', (req, res) => {
    const grantType = req.body?.grant_type;
    const apiKeyFromHeader = extractApiKey(req.headers.authorization);

    let apiKey: string | null = apiKeyFromHeader || process.env.HARBOR_API_KEY || null;

    if (grantType === 'authorization_code') {
      const code = req.body?.code;
      const mapped = code ? oauthCodes.get(String(code)) : null;
      if (mapped) {
        apiKey = mapped.apiKey;
        oauthCodes.delete(String(code));
      }
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Missing Authorization header or HARBOR_API_KEY',
      });
    }

    const accessToken = `mcp_token_${randomUUID()}`;
    const refreshToken = `mcp_refresh_${randomUUID()}`;
    oauthTokens.set(accessToken, { apiKey });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: 'mcp',
    });
  });

  // Authentication middleware for MCP endpoints
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      logger.warn('Request without Authorization header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header. Include your Harbor API key as: Authorization: Bearer hbr_live_xxx',
      });
    }

    // Store API key in request for later use
    (req as any).apiKey = apiKey;
    next();
  };

  // MCP endpoint - handles all MCP protocol messages (GET/POST/DELETE)
  app.all('/mcp', (req, res, next) => {
    // Log all incoming headers BEFORE auth check for debugging
    logger.info('Incoming MCP request headers (before auth)', {
      headers: req.headers,
      method: req.method,
      path: req.path,
    });
    next();
  }, requireAuth, async (req, res) => {
    try {
      const apiKey = (req as any).apiKey;
      const rawSessionId = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

      let transport: StreamableHTTPServerTransport | undefined;
      let context: ServerContext | undefined;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId);
        context = sessionContexts.get(sessionId);
        if (!context) {
          logger.warn('Missing session context for existing session', { sessionId });
          context = await initializeContextForApiKey(apiKey);
          sessionContexts.set(sessionId, context);
        } else {
          logger.debug('Reusing session context', { sessionId });
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        logger.info('Initializing new session with API key');
        context = await initializeContextForApiKey(apiKey);
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport!);
            sessionContexts.set(newSessionId, context!);
            logger.debug('Stored session context', { sessionId: newSessionId });
          },
          onsessionclosed: (closedSessionId) => {
            transports.delete(closedSessionId);
            sessionContexts.delete(closedSessionId);
            logger.debug('Cleaned up session context', { sessionId: closedSessionId });
          },
        });
        transport.onclose = () => {
          const activeSessionId = transport?.sessionId;
          if (activeSessionId) {
            transports.delete(activeSessionId);
            sessionContexts.delete(activeSessionId);
            logger.debug('Cleaned up session context', { sessionId: activeSessionId });
          }
        };
        const server = createMcpServer(context);
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      if (!transport) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Not Found: Session does not exist',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', error);

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid Harbor API key',
        });
      }

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // SSE endpoint for streaming
  app.get('/sse', (req, res, next) => {
    // Log all incoming headers BEFORE auth check for debugging
    logger.info('Incoming SSE request headers (before auth)', {
      headers: req.headers,
      method: req.method,
      path: req.path,
    });
    next();
  }, requireAuth, async (req, res) => {
    try {

      const apiKey = (req as any).apiKey;

      // Create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // Get or create context
      let context: ServerContext;
      const sessionId = transport.sessionId;

      if (sessionId && sessionContexts.has(sessionId)) {
        context = sessionContexts.get(sessionId)!;
      } else {
        logger.info('Initializing new SSE session with API key');
        context = await initializeContextForApiKey(apiKey);
        if (sessionId) {
          sessionContexts.set(sessionId, context);
        }
      }

      // Create MCP server
      const server = createMcpServer(context);
      await server.connect(transport);

      // Handle SSE request
      await transport.handleRequest(req, res);

      // Clean up on close
      transport.onclose = () => {
        if (sessionId) {
          sessionContexts.delete(sessionId);
        }
      };
    } catch (error) {
      logger.error('Error handling SSE request', error);

      if (error instanceof Error && error.message.includes('Authentication failed')) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid Harbor API key',
        });
      }

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // JSON 404 for any other route (avoids HTML error pages for clients expecting JSON)
  app.use((req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Unknown endpoint',
    });
  });

  // Start HTTP server
  const httpServer = app.listen(port, '127.0.0.1', () => {
    logger.info('Harbor MCP HTTP Server ready', {
      port,
      endpoint: `http://127.0.0.1:${port}/mcp`,
      health: `http://127.0.0.1:${port}/health`,
    });

    console.log(`\n✓ Harbor MCP HTTP Server ready!`);
    console.log(`  Endpoint: http://127.0.0.1:${port}/mcp`);
    console.log(`  Health: http://127.0.0.1:${port}/health`);
    console.log(`\nAuthentication required via Authorization header.`);
    console.log(`\nTo add this server to Claude Code, run:`);
    console.log(`  claude mcp add --transport http harbor http://127.0.0.1:${port}/mcp -H "Authorization: Bearer YOUR_HARBOR_API_KEY"\n`);
    console.log(`Replace YOUR_HARBOR_API_KEY with your actual Harbor API key (e.g., hbr_live_xxx)\n`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down HTTP server...');

    // Clean up all session contexts
    sessionContexts.clear();

    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start server
startHttpServer().catch((error) => {
  logger.error('Fatal error starting HTTP server', error);
  process.exit(1);
});
