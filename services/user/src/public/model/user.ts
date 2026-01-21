import { UserType, SubType } from './userType.js';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  userType: UserType;
  subType: SubType;
  googleId: string | null;
  onboardingCompleted: boolean;
}
