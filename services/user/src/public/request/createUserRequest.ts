import { UserType } from '../model/userType.js';

export interface CreateUserRequest {
  name: string;
  type: UserType;
  email: string;
  phone: string;
}
