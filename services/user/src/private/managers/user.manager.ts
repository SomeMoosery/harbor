import type { Logger } from '@harbor/logger';
import { ConflictError, NotFoundError } from '@harbor/errors';
import { UserResource } from '../resources/user.resource.js';
import { AgentResource } from '../resources/agent.resource.js';
import { User } from '../../public/model/user.js';
import { Agent } from '../../public/model/agent.js';
import { UserType } from '../../public/model/userType.js';
import { AgentType } from '../../public/model/agentType.js';

/**
 * UserManager orchestrates business logic for users and agents
 */
export class UserManager {
  constructor(
    private readonly userResource: UserResource,
    private readonly agentResource: AgentResource,
    private readonly logger: Logger
  ) {}

  async createUser(data: {
    name: string;
    type: UserType;
    email: string;
    phone: string;
  }): Promise<User> {
    this.logger.info({ data }, 'Creating user');

    // Email and phone uniqueness is enforced by database constraints
    // If duplicate, DB will throw an error
    try {
      return await this.userResource.create(data);
    } catch (error) {
      // Check if it's a unique constraint violation
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError('User with this email or phone already exists');
      }
      throw error;
    }
  }

  async getUser(id: string): Promise<User> {
    return this.userResource.findById(id);
  }

  async createAgent(data: {
    userId: string;
    name: string;
    capabilities: Record<string, unknown>;
    type: AgentType;
  }): Promise<Agent> {
    this.logger.info({ data }, 'Creating agent');

    // Verify user exists
    const userExists = await this.userResource.exists(data.userId);
    if (!userExists) {
      throw new NotFoundError('User', data.userId);
    }

    // Check for duplicate agent name for this user
    const existingAgents = await this.agentResource.findByUserId(data.userId);
    const duplicateName = existingAgents.some((agent) => agent.name === data.name);
    if (duplicateName) {
      throw new ConflictError(`Agent with name '${data.name}' already exists for this user`);
    }

    try {
      return await this.agentResource.create(data);
    } catch (error) {
      // The unique index on (user_id, name) might also catch this
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError(`Agent with name '${data.name}' already exists for this user`);
      }
      throw error;
    }
  }

  async getAgentsForUser(userId: string): Promise<Agent[]> {
    // Verify user exists first
    const userExists = await this.userResource.exists(userId);
    if (!userExists) {
      throw new NotFoundError('User', userId);
    }

    return this.agentResource.findByUserId(userId);
  }

  async updateAgentType(id: string, type: AgentType): Promise<Agent> {
    this.logger.info({ agentId: id, type }, 'Updating agent type');

    return this.agentResource.updateType(id, type);
  }

  async deleteUser(id: string): Promise<void> {
    this.logger.info({ userId: id }, 'Deleting user with cascade to agents');

    // Soft delete user
    await this.userResource.softDelete(id);

    // Cascade soft delete to all agents
    await this.agentResource.softDeleteByUserId(id);
  }
}
