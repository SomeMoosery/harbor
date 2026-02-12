import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { SERVICE_PORTS } from '@harbor/config';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createOAuthHandler, OAuthConfig } from '../auth/oauth.js';
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  STATE_COOKIE,
  SESSION_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS,
  STATE_COOKIE_OPTIONS,
  getCookies,
  setCookie,
  clearCookie,
  createSession,
  deleteSession,
  createSessionMiddleware,
  validateSession,
} from '../auth/session.js';
import { randomUUID } from 'crypto';

/**
 * Create HTTP routes for the gateway
 * These endpoints proxy to downstream services
 */
export function createHttpRoutes(
  config: Config,
  logger: Logger,
  wsServer: { broadcast: (event: any) => void; sendToAgent: (agentId: string, event: any) => void }
) {
  const app = new Hono();

  // Get OAuth config from environment
  const oauthConfig: OAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${config.port}/auth/callback`,
    sessionSecret: process.env.SESSION_SECRET || '',
    mockOAuth: process.env.MOCK_OAUTH === 'true',
  };

  // Dashboard URL for redirects (different port in development)
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3100';

  // Validate required config
  if (!oauthConfig.sessionSecret) {
    logger.error('SESSION_SECRET environment variable is required');
    throw new Error('SESSION_SECRET environment variable is required');
  }

  if (!oauthConfig.mockOAuth && (!oauthConfig.clientId || !oauthConfig.clientSecret)) {
    logger.warn('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set. Set MOCK_OAUTH=true for development.');
  }

  const oauth = createOAuthHandler(oauthConfig, logger);

  // Enable CORS for local development
  // Note: credentials: true requires explicit origin (not '*')
  app.use('/*', cors({
    origin: dashboardUrl,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
  }));

  const apiKeyAuth = createAuthMiddleware(config, logger);
  const sessionAuth = createSessionMiddleware(logger, false);

  const ensureAgentOwnership = async (userId: string, agentId: string) => {
    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/users/${userId}/agents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch agents');
    }

    const agents = await response.json();
    return Array.isArray(agents) && agents.some((agent) => agent.id === agentId);
  };

  // Health check (no auth required)
  app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }));

  // ===================
  // OAuth Authentication Routes
  // ===================
  // TODO: Add rate limiting to auth endpoints to prevent brute force attacks
  // Consider: IP-based limits for /auth/login and /auth/callback
  // See: https://hono.dev/middleware/builtin/rate-limiter

  /**
   * GET /auth/login - Initiates OAuth flow
   * Redirects to Google OAuth consent screen (or mock in dev)
   */
  app.get('/auth/login', (c) => {
    logger.info({ mockMode: oauth.isMockMode }, 'Initiating OAuth login');

    if (oauth.isMockMode) {
      // In mock mode, redirect directly to callback with mock code
      const state = oauth.generateState();
      setCookie(c, STATE_COOKIE, state, STATE_COOKIE_OPTIONS);
      return c.redirect(`/auth/callback?code=mock_code&state=${state}`);
    }

    // Generate state for CSRF protection
    const state = oauth.generateState();
    setCookie(c, STATE_COOKIE, state, STATE_COOKIE_OPTIONS);

    // Redirect to Google
    const authUrl = oauth.getAuthUrl(state);
    return c.redirect(authUrl);
  });

  /**
   * GET /auth/callback - OAuth callback handler
   * Exchanges code for tokens, creates session
   */
  app.get('/auth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // Handle OAuth errors
    if (error) {
      logger.warn({ error }, 'OAuth error');
      return c.redirect(`${dashboardUrl}?error=oauth_cancelled`);
    }

    // Verify state parameter
    const cookies = getCookies(c);
    const savedState = cookies[STATE_COOKIE];

    if (!state || !savedState || state !== savedState || !oauth.verifyState(state)) {
      logger.warn('OAuth state mismatch');
      return c.redirect(`${dashboardUrl}?error=invalid_state`);
    }

    // Clear state cookie
    clearCookie(c, STATE_COOKIE);

    if (!code) {
      logger.warn('No authorization code');
      return c.redirect(`${dashboardUrl}?error=no_code`);
    }

    try {
      // Get user profile (mock or real)
      let profile;
      if (oauth.isMockMode) {
        profile = oauth.getMockProfile();
      } else {
        profile = await oauth.exchangeCodeForProfile(code);
      }

      // Create session via User Service
      const ipAddress = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
        || c.req.header('X-Real-IP');
      const userAgent = c.req.header('User-Agent');

      const sessionResult = await createSession(profile, ipAddress, userAgent, logger);

      if (!sessionResult) {
        return c.redirect(`${dashboardUrl}?error=session_failed`);
      }

      // Set session cookie
      setCookie(c, SESSION_COOKIE, sessionResult.sessionToken, SESSION_COOKIE_OPTIONS);

      // Set CSRF cookie (for double-submit pattern)
      const csrfToken = randomUUID();
      setCookie(c, CSRF_COOKIE, csrfToken, CSRF_COOKIE_OPTIONS);

      logger.info(
        { userId: sessionResult.user.id, isNewUser: sessionResult.isNewUser },
        'OAuth login successful'
      );

      // Redirect to dashboard (React will handle onboarding check)
      return c.redirect(dashboardUrl);
    } catch (err) {
      logger.error({ error: err }, 'OAuth callback failed');
      return c.redirect(`${dashboardUrl}?error=auth_failed`);
    }
  });

  /**
   * POST /auth/logout - Logout
   * Requires valid session
   */
  app.post('/auth/logout', sessionAuth, async (c) => {
    const cookies = getCookies(c);
    const sessionToken = cookies[SESSION_COOKIE];

    if (sessionToken) {
      await deleteSession(sessionToken, logger);
    }

    // Clear cookies
    clearCookie(c, SESSION_COOKIE);
    clearCookie(c, CSRF_COOKIE);

    logger.info('User logged out');
    return c.json({ success: true });
  });

  /**
   * GET /auth/me - Get current user info
   * Returns user data if authenticated
   */
  app.get('/auth/me', async (c) => {
    const cookies = getCookies(c);
    const sessionToken = cookies[SESSION_COOKIE];

    if (!sessionToken) {
      return c.json({ authenticated: false }, 200);
    }

    const session = await validateSession(sessionToken, logger);

    if (!session) {
      clearCookie(c, SESSION_COOKIE);
      clearCookie(c, CSRF_COOKIE);
      return c.json({ authenticated: false }, 200);
    }

    return c.json({
      authenticated: true,
      user: session.user,
    });
  });

  // ===================
  // Dashboard API Routes (session auth)
  // ===================

  /**
   * POST /api/onboarding/complete - Complete onboarding
   */
  app.post('/api/onboarding/complete', sessionAuth, async (c) => {
    const session = c.get('session');
    const body = await c.req.json();

    const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userServiceUrl}/onboarding/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.userId,
        ...body,
      }),
    });

    return c.json(await response.json(), response.status as any);
  });

  /**
   * PATCH /api/users/:userId/type - Change user type
   */
  app.patch('/api/users/:userId/type', sessionAuth, async (c) => {
    const userId = c.req.param('userId');
    const session = c.get('session');

    // Users can only change their own type
    if (userId !== session.userId) {
      return c.json({ error: 'Forbidden' }, 403 as any);
    }

    const body = await c.req.json();

    const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userServiceUrl}/users/${userId}/type`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  // ===================
  // Dashboard Routes (session auth)
  // ===================

  app.get('/dashboard/asks', sessionAuth, async (c) => {
    const session = c.get('session');
    const agentId = c.req.query('agentId');

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/asks?createdBy=${agentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch asks for dashboard');
      return c.json({ error: 'Failed to fetch asks' }, 500 as any);
    }
  });

  app.get('/dashboard/asks/:askId/bids', sessionAuth, async (c) => {
    const askId = c.req.param('askId');

    try {
      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/asks/${askId}/bids`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch bids for ask');
      return c.json({ error: 'Failed to fetch bids' }, 500 as any);
    }
  });

  app.get('/dashboard/bids', sessionAuth, async (c) => {
    const session = c.get('session');
    const agentId = c.req.query('agentId');

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/bids?agentId=${agentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch bids for dashboard');
      return c.json({ error: 'Failed to fetch bids' }, 500 as any);
    }
  });

  app.post('/dashboard/asks', sessionAuth, async (c) => {
    const session = c.get('session');
    const body = await c.req.json();
    const { agentId, ...askData } = body ?? {};

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/asks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agentId,
        },
        body: JSON.stringify(askData),
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to create ask');
      return c.json({ error: 'Failed to create ask' }, 500 as any);
    }
  });

  app.post('/dashboard/bids/accept', sessionAuth, async (c) => {
    const session = c.get('session');
    const body = await c.req.json();
    const { agentId, bidId } = body ?? {};

    if (!agentId || !bidId) {
      return c.json({ error: 'agentId and bidId are required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/bids/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agentId,
        },
        body: JSON.stringify({ bidId }),
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to accept bid');
      return c.json({ error: 'Failed to accept bid' }, 500 as any);
    }
  });

  app.post('/dashboard/delivery', sessionAuth, async (c) => {
    const body = await c.req.json();
    const { agentId, bidId, deliveryProof } = body ?? {};

    if (!agentId || !bidId) {
      return c.json({ error: 'agentId and bidId are required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/delivery/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agentId,
        },
        body: JSON.stringify({ bidId, deliveryProof }),
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to submit delivery');
      return c.json({ error: 'Failed to submit delivery' }, 500 as any);
    }
  });

  app.post('/dashboard/asks/:id/cancel', sessionAuth, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { agentId } = body ?? {};

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400 as any);
    }

    try {
      const owned = await ensureAgentOwnership(session.userId, agentId);
      if (!owned) {
        return c.json({ error: 'Forbidden' }, 403 as any);
      }

      const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
      const response = await fetch(`${tenderingUrl}/asks/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agentId,
        },
      });

      return c.json(await response.json(), response.status as any);
    } catch (error) {
      logger.error({ error }, 'Failed to cancel ask');
      return c.json({ error: 'Failed to cancel ask' }, 500 as any);
    }
  });

  // ===================
  // Internal Events (no auth - internal only)
  // ===================

  app.post('/internal/events', async (c) => {
    try {
      const body = await c.req.json();
      const { type, data, targetAgentId } = body;

      if (targetAgentId) {
        wsServer.sendToAgent(targetAgentId, { type, data });
      } else {
        wsServer.broadcast({ type, data });
      }

      logger.info({ type, targetAgentId }, 'Event published');
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to publish event');
      return c.json({ error: 'Failed to publish event' }, 500 as any);
    }
  });

  // ===================
  // API Key Protected Routes
  // ===================

  app.use('/api/*', apiKeyAuth);

  // Proxy to tendering service
  app.post('/api/asks', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/asks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/bids', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/bids/accept', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/delivery', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/delivery/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  // ===================
  // Proxy Routes (no /api prefix)
  // ===================

  app.post('/api-keys/validate', async (c) => {
    const body = await c.req.json();

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/api-keys/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api-keys', async (c) => {
    const body = await c.req.json();

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/users/:userId/api-keys', async (c) => {
    const userId = c.req.param('userId');

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/users/${userId}/api-keys`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/users/:userId', async (c) => {
    const userId = c.req.param('userId');

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/users/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/users/:userId/agents', async (c) => {
    const userId = c.req.param('userId');

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/users/${userId}/agents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/users/:userId/agents', async (c) => {
    const userId = c.req.param('userId');
    const body = await c.req.json();

    const userUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userUrl}/users/${userId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  // Proxy to wallet service
  app.post('/wallets', async (c) => {
    const body = await c.req.json();

    const walletUrl = `http://localhost:${SERVICE_PORTS.wallet}`;
    const response = await fetch(`${walletUrl}/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/wallets/:id', async (c) => {
    const id = c.req.param('id');

    const walletUrl = `http://localhost:${SERVICE_PORTS.wallet}`;
    const response = await fetch(`${walletUrl}/wallets/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/wallets/agent/:agentId', async (c) => {
    const agentId = c.req.param('agentId');

    const walletUrl = `http://localhost:${SERVICE_PORTS.wallet}`;
    const response = await fetch(`${walletUrl}/wallets/agent/${agentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/wallets/agent/:agentId/balance', async (c) => {
    const agentId = c.req.param('agentId');

    const walletUrl = `http://localhost:${SERVICE_PORTS.wallet}`;
    const response = await fetch(`${walletUrl}/wallets/agent/${agentId}/balance`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/funding/checkout', async (c) => {
    const body = await c.req.json();

    const walletUrl = `http://localhost:${SERVICE_PORTS.wallet}`;
    const response = await fetch(`${walletUrl}/funding/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  // Proxy to tendering service (without /api prefix for MCP server)
  app.post('/asks', async (c) => {
    const agentId = c.req.header('X-Agent-Id');
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/asks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId || '',
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/asks/:id', async (c) => {
    const id = c.req.param('id');

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/asks/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.get('/asks/:askId/bids', async (c) => {
    const askId = c.req.param('askId');

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/asks/${askId}/bids`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/bids', async (c) => {
    const agentId = c.req.header('X-Agent-Id');
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId || '',
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/bids/accept', async (c) => {
    const agentId = c.req.header('X-Agent-Id');
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': agentId || '',
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  return app;
}
