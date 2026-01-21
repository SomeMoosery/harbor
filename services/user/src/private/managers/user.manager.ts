import type { Logger } from '@harbor/logger';
import { ConflictError, NotFoundError } from '@harbor/errors';
import { UserResource } from '../resources/user.resource.js';
import { AgentResource } from '../resources/agent.resource.js';
import { User } from '../../public/model/user.js';
import { Agent } from '../../public/model/agent.js';
import { AgentType } from '../../public/model/agentType.js';
import { WalletClient } from '@harbor/wallet/client';

/**
 * UserManager orchestrates business logic for users and agents
 */
export class UserManager {
  private readonly walletClient: WalletClient;

  constructor(
    private readonly userResource: UserResource,
    private readonly agentResource: AgentResource,
    private readonly logger: Logger,
    walletClient?: WalletClient
  ) {
    this.walletClient = walletClient ?? new WalletClient();
  }

  async getUser(id: string): Promise<User> {
    return this.userResource.findById(id);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.agentResource.findById(id);
  }

  async createAgent(data: {
    userId: string;
    name: string;
    capabilities: Record<string, unknown>;
    type: AgentType;
  }): Promise<Agent> {
    this.logger.info({ data }, 'Creating agent');

    // Verify user exists
    await this.verifyUserExists(data.userId);

    // Check for duplicate agent name for this user
    await this.checkDuplicateAgentName(data.userId, data.name);

    try {
      const agent = await this.agentResource.create(data);

      // Create wallet for the agent asynchronously
      this.createAgentWallet(agent.id);

      return agent;
    } catch (error) {
      // The unique index on (user_id, name) might also catch this
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictError(`Agent with name '${data.name}' already exists for this user`);
      }
      throw error;
    }
  }

  private async verifyUserExists(userId: string): Promise<void> {
    const userExists = await this.userResource.exists(userId);
    if (!userExists) {
      throw new NotFoundError('User', userId);
    }
  }

  private async checkDuplicateAgentName(userId: string, name: string): Promise<void> {
    const existingAgents = await this.agentResource.findByUserId(userId);
    const duplicateName = existingAgents.some((agent) => agent.name === name);
    if (duplicateName) {
      throw new ConflictError(`Agent with name '${name}' already exists for this user`);
    }
  }

  private createAgentWallet(agentId: string): void {
    // Note: We're not awaiting this to keep it simple. In a production system,
    // you might want to use a saga pattern or event-driven architecture
    // to ensure atomicity.
    this.walletClient.createWallet({ agentId }).catch((error: any) => {
      this.logger.error(
        { error, agentId },
        'Failed to create wallet for agent. Wallet will need to be created manually.'
      );
    });
  }

  async getAgentsForUser(userId: string): Promise<Agent[]> {
    // Verify user exists first
    await this.verifyUserExists(userId);

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
