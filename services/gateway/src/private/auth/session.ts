import type { Context, Next } from 'hono';
import type { Logger } from '@harbor/logger';
import { SERVICE_PORTS } from '@harbor/config';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';

// Cookie names
export const SESSION_COOKIE = 'harbor_session';
export const CSRF_COOKIE = 'harbor_csrf';
export const STATE_COOKIE = 'harbor_oauth_state';

// Cookie options
const isProduction = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // JavaScript needs to read this
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 5 * 60, // 5 minutes for OAuth flow
};

/**
 * Parse cookies from request
 */
export function getCookies(c: Context): Record<string, string> {
  const cookieHeader = c.req.header('Cookie') || '';
  return parseCookie(cookieHeader);
}

/**
 * Set a cookie in response
 */
export function setCookie(
  c: Context,
  name: string,
  value: string,
  options: typeof SESSION_COOKIE_OPTIONS
): void {
  const cookie = serializeCookie(name, value, options);
  c.header('Set-Cookie', cookie, { append: true });
}

/**
 * Clear a cookie
 */
export function clearCookie(c: Context, name: string): void {
  const cookie = serializeCookie(name, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  c.header('Set-Cookie', cookie, { append: true });
}

/**
 * Session data returned from validation
 */
export interface SessionData {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
    subType: string;
    onboardingCompleted: boolean;
  };
}

/**
 * Validate session with User Service
 */
export async function validateSession(
  sessionToken: string,
  logger: Logger
): Promise<SessionData | null> {
  try {
    const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userServiceUrl}/sessions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      valid: boolean;
      userId: string;
      user: SessionData['user'];
    };

    if (!data.valid) {
      return null;
    }

    return {
      userId: data.userId,
      user: data.user,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to validate session');
    return null;
  }
}

/**
 * Create session with User Service (after OAuth)
 */
export async function createSession(
  profile: { googleId: string; email: string; name: string },
  ipAddress: string | undefined,
  userAgent: string | undefined,
  logger: Logger
): Promise<{
  sessionToken: string;
  expiresAt: string;
  user: SessionData['user'];
  isNewUser: boolean;
} | null> {
  try {
    const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userServiceUrl}/sessions/oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ipAddress && { 'X-Forwarded-For': ipAddress }),
        ...(userAgent && { 'User-Agent': userAgent }),
      },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to create session');
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error({ error }, 'Failed to create session');
    return null;
  }
}

/**
 * Delete session with User Service (logout)
 */
export async function deleteSession(
  sessionToken: string,
  logger: Logger
): Promise<boolean> {
  try {
    const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
    const response = await fetch(`${userServiceUrl}/sessions/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });

    return response.ok;
  } catch (error) {
    logger.error({ error }, 'Failed to delete session');
    return false;
  }
}

/**
 * Session middleware - validates session cookie and populates context
 * Redirects to login if session is invalid
 */
export function createSessionMiddleware(logger: Logger, redirectOnFail = true) {
  return async (c: Context, next: Next) => {
    const cookies = getCookies(c);
    const sessionToken = cookies[SESSION_COOKIE];

    if (!sessionToken) {
      if (redirectOnFail) {
        return c.redirect('/auth/login');
      }
      return c.json({ error: 'Not authenticated' }, 401 as any);
    }

    const session = await validateSession(sessionToken, logger);

    if (!session) {
      // Clear invalid cookie
      clearCookie(c, SESSION_COOKIE);
      clearCookie(c, CSRF_COOKIE);

      if (redirectOnFail) {
        return c.redirect('/auth/login');
      }
      return c.json({ error: 'Session expired' }, 401 as any);
    }

    // Store session data in context
    c.set('session', session);
    c.set('userId', session.userId);
    c.set('user', session.user);

    await next();
  };
}

/**
 * CSRF validation middleware
 * Checks X-CSRF-Token header matches csrf cookie
 */
export function createCsrfMiddleware(logger: Logger) {
  return async (c: Context, next: Next) => {
    // Only check on state-changing methods
    const method = c.req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next();
    }

    const cookies = getCookies(c);
    const csrfCookie = cookies[CSRF_COOKIE];
    const csrfHeader = c.req.header('X-CSRF-Token');

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      logger.warn('CSRF token mismatch');
      return c.json({ error: 'Invalid CSRF token' }, 403 as any);
    }

    await next();
  };
}
