import { Temporal } from 'temporal-polyfill';
import { UserType, SubType } from '../../public/model/userType.js';

/**
 * Database record for User - includes all database fields including timestamps
 */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  userType: UserType;
  subType: SubType;
  googleId: string | null;
  onboardingCompleted: boolean;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt: Temporal.ZonedDateTime | null;
}
