import { UserType } from './userType.js';

export interface User {
  id: string;
  name: string;
  type: UserType;
  email: string;
  phone: string;
}
