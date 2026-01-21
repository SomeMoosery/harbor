import { Temporal } from 'temporal-polyfill';

/**
 * Database record for Session - includes all database fields
 */
export interface SessionRecord {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Temporal.ZonedDateTime;
  createdAt: Temporal.ZonedDateTime;
  lastAccessedAt: Temporal.ZonedDateTime;
  ipAddress: string | null;
  userAgent: string | null;
}
