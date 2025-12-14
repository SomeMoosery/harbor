import { Temporal } from 'temporal-polyfill';
import { UserType } from '../../public/model/userType.js';

/**
 * Database record for User - includes all database fields including timestamps
 */
export interface UserRecord {
  id: string;
  name: string;
  type: UserType;
  email: string;
  phone: string;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt: Temporal.ZonedDateTime | null;
}
