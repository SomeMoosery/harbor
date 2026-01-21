export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Session with associated user data for validation responses
 */
export interface SessionWithUser {
  session: Session;
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
    subType: string;
    onboardingCompleted: boolean;
  };
}
