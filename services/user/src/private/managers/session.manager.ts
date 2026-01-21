import type { Logger } from '@harbor/logger';
import { UnauthorizedError, ValidationError } from '@harbor/errors';
import { SessionResource } from '../resources/session.resource.js';
import { UserResource } from '../resources/user.resource.js';
import { Session, SessionWithUser } from '../../public/model/session.js';
import { User } from '../../public/model/user.js';
import { UserType, SubType } from '../../public/model/userType.js';

export class SessionManager {
  constructor(
    private readonly sessionResource: SessionResource,
    private readonly userResource: UserResource,
    private readonly logger: Logger
  ) {}

  /**
   * Create or retrieve user from OAuth profile and create session
   */
  async createSessionFromOAuth(data: {
    googleId: string;
    email: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ session: Session; user: User; isNewUser: boolean }> {
    this.logger.info({ email: data.email }, 'Creating session from OAuth');

    // Try to find existing user by Google ID
    let user = await this.userResource.findByGoogleId(data.googleId);
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await this.userResource.createFromOAuth({
        name: data.name,
        email: data.email,
        googleId: data.googleId,
      });
      isNewUser = true;
      this.logger.info({ userId: user.id }, 'Created new user from OAuth');
    }

    // Create session
    const session = await this.sessionResource.create({
      userId: user.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return { session, user, isNewUser };
  }

  /**
   * Validate a session token
   */
  async validateSession(sessionToken: string): Promise<SessionWithUser> {
    const result = await this.sessionResource.validateAndExtend(sessionToken);

    if (!result) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    return result;
  }

  /**
   * Logout - delete session
   */
  async logout(sessionToken: string): Promise<void> {
    const deleted = await this.sessionResource.deleteByToken(sessionToken);

    if (!deleted) {
      throw new UnauthorizedError('Session not found');
    }

    this.logger.info('Session deleted (logout)');
  }

  /**
   * Complete onboarding - update user type
   */
  async completeOnboarding(
    userId: string,
    userType: UserType,
    subType?: SubType
  ): Promise<User> {
    this.logger.info({ userId, userType, subType }, 'Completing onboarding');

    // Validate user type
    if (userType === 'UNKNOWN') {
      throw new ValidationError('Cannot set user type to UNKNOWN');
    }

    // Determine sub-type based on user type
    let finalSubType: SubType;

    if (userType === 'AGENT') {
      // Agents always get AUTONOMOUS sub-type
      finalSubType = 'AUTONOMOUS';
    } else if (userType === 'HUMAN') {
      // Humans must specify BUSINESS or PERSONAL
      if (!subType || (subType !== 'BUSINESS' && subType !== 'PERSONAL')) {
        throw new ValidationError('Human users must specify BUSINESS or PERSONAL sub-type');
      }
      finalSubType = subType;
    } else {
      throw new ValidationError(`Invalid user type: ${userType}`);
    }

    return this.userResource.updateUserType(userId, userType, finalSubType);
  }

  /**
   * Change user type (settings page)
   */
  async changeUserType(
    userId: string,
    newUserType: UserType,
    newSubType?: SubType
  ): Promise<User> {
    this.logger.info({ userId, newUserType, newSubType }, 'Changing user type');

    // Get current user
    const user = await this.userResource.findById(userId);

    // If switching to AGENT, check for child agents
    if (newUserType === 'AGENT' && user.userType === 'HUMAN') {
      const agentCount = await this.userResource.countAgents(userId);
      if (agentCount > 0) {
        throw new ValidationError(
          `Cannot switch to AGENT type while you have ${agentCount} child agent(s). Delete them first.`
        );
      }
    }

    // Validate and determine sub-type
    let finalSubType: SubType;

    if (newUserType === 'AGENT') {
      finalSubType = 'AUTONOMOUS';
    } else if (newUserType === 'HUMAN') {
      if (!newSubType || (newSubType !== 'BUSINESS' && newSubType !== 'PERSONAL')) {
        throw new ValidationError('Human users must specify BUSINESS or PERSONAL sub-type');
      }
      finalSubType = newSubType;
    } else {
      throw new ValidationError(`Invalid user type: ${newUserType}`);
    }

    return this.userResource.updateUserType(userId, newUserType, finalSubType);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    return this.userResource.findById(userId);
  }
}
