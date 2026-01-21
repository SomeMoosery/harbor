import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { SessionManager } from '../managers/session.manager.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * Controller handles HTTP request/response for session management
 */
export class SessionController {
  constructor(
    private readonly manager: SessionManager,
    private readonly logger: Logger
  ) {}

  /**
   * Create session from OAuth data (called by Gateway after OAuth exchange)
   */
  async createFromOAuth(c: Context) {
    try {
      const body = await c.req.json<{
        googleId: string;
        email: string;
        name: string;
      }>();

      // Get IP and User-Agent from headers (forwarded by Gateway)
      const ipAddress = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
        || c.req.header('X-Real-IP')
        || undefined;
      const userAgent = c.req.header('User-Agent') || undefined;

      const result = await this.manager.createSessionFromOAuth({
        ...body,
        ipAddress,
        userAgent,
      });

      return c.json({
        sessionToken: result.session.sessionToken,
        expiresAt: result.session.expiresAt.toISOString(),
        user: result.user,
        isNewUser: result.isNewUser,
      }, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  /**
   * Validate session token
   */
  async validateSession(c: Context) {
    try {
      const body = await c.req.json<{ sessionToken: string }>();

      const result = await this.manager.validateSession(body.sessionToken);

      return c.json({
        valid: true,
        userId: result.user.id,
        user: result.user,
        session: {
          expiresAt: result.session.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      // For validation, return valid: false instead of error
      return c.json({ valid: false }, 200);
    }
  }

  /**
   * Delete session (logout)
   */
  async logout(c: Context) {
    try {
      const body = await c.req.json<{ sessionToken: string }>();

      await this.manager.logout(body.sessionToken);

      return c.json({ success: true });
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(c: Context) {
    try {
      const body = await c.req.json<{
        userId: string;
        userType: 'HUMAN' | 'AGENT';
        subType?: 'BUSINESS' | 'PERSONAL';
      }>();

      const user = await this.manager.completeOnboarding(
        body.userId,
        body.userType,
        body.subType
      );

      return c.json(user);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  /**
   * Change user type (from settings)
   */
  async changeUserType(c: Context) {
    try {
      const userId = c.req.param('userId');
      const body = await c.req.json<{
        userType: 'HUMAN' | 'AGENT';
        subType?: 'BUSINESS' | 'PERSONAL';
      }>();

      const user = await this.manager.changeUserType(
        userId,
        body.userType,
        body.subType
      );

      return c.json(user);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  /**
   * Get current user
   */
  async getUser(c: Context) {
    try {
      const userId = c.req.param('userId');
      const user = await this.manager.getUser(userId);

      return c.json(user);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }
}
