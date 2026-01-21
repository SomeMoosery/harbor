import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import { Session, SessionWithUser } from '../../public/model/session.js';
import { randomUUID } from 'crypto';

/**
 * Database row type for sessions table
 */
interface SessionRow {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Joined row for session validation with user data
 */
interface SessionWithUserRow extends SessionRow {
  user_name: string;
  user_email: string;
  user_type: string;
  sub_type: string;
  onboarding_completed: boolean;
}

// Session duration: 7 days in milliseconds
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export class SessionResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new session for a user
   */
  async create(data: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    this.logger.info({ userId: data.userId }, 'Creating session');

    const [row] = await this.sql<SessionRow[]>`
      INSERT INTO sessions (user_id, session_token, expires_at, ip_address, user_agent)
      VALUES (${data.userId}, ${sessionToken}, ${expiresAt}, ${data.ipAddress ?? null}, ${data.userAgent ?? null})
      RETURNING *
    `;

    if (!row) {
      throw new Error('Failed to create session');
    }

    return this.rowToSession(row);
  }

  /**
   * Validate a session token and return session with user data
   * Also extends the session (sliding window)
   */
  async validateAndExtend(sessionToken: string): Promise<SessionWithUser | null> {
    // First, get the session with user data
    const [row] = await this.sql<SessionWithUserRow[]>`
      SELECT
        s.*,
        u.name as user_name,
        u.email as user_email,
        u.user_type,
        u.sub_type,
        u.onboarding_completed
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken}
        AND s.expires_at > NOW()
        AND u.deleted_at IS NULL
    `;

    if (!row) {
      return null;
    }

    // Extend the session (sliding window)
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.sql`
      UPDATE sessions
      SET expires_at = ${newExpiresAt},
          last_accessed_at = NOW()
      WHERE id = ${row.id}
    `;

    return {
      session: this.rowToSession(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        userType: row.user_type,
        subType: row.sub_type,
        onboardingCompleted: row.onboarding_completed,
      },
    };
  }

  /**
   * Delete a session by token (logout)
   */
  async deleteByToken(sessionToken: string): Promise<boolean> {
    this.logger.info('Deleting session');

    const result = await this.sql`
      DELETE FROM sessions
      WHERE session_token = ${sessionToken}
    `;

    return result.count > 0;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    this.logger.info({ userId }, 'Deleting all sessions for user');

    await this.sql`
      DELETE FROM sessions
      WHERE user_id = ${userId}
    `;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.sql`
      DELETE FROM sessions
      WHERE expires_at < NOW()
    `;

    return result.count;
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }
}
