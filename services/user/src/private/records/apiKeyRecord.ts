import type { Temporal } from 'temporal-polyfill';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  key: string;
  name?: string;
  lastUsedAt?: Temporal.ZonedDateTime;
  createdAt: Temporal.ZonedDateTime;
  deletedAt?: Temporal.ZonedDateTime;
}
