import type { Temporal } from 'temporal-polyfill';

export interface ApiKey {
  id: string;
  userId: string;
  key: string;
  name?: string;
  lastUsedAt?: Temporal.ZonedDateTime;
  createdAt: Temporal.ZonedDateTime;
}
