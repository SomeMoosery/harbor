import { z } from 'zod';
import { getServiceUrl } from '@harbor/config/ports';
import { CreateUserRequest } from '../request/createUserRequest.js';
import { CreateAgentRequest } from '../request/createAgentRequest.js';
import { User } from '../model/user.js';
import { Agent } from '../model/agent.js';
import { userSchema, agentSchema } from '../schemas/index.js';

/**
 * Type-safe HTTP client for User service
 * Other services use this to communicate with the User service
 */
export class UserClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('user');
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }

    const json = await response.json();
    return userSchema.parse(json);
  }

  async getUser(id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.statusText}`);
    }

    const json = await response.json();
    return userSchema.parse(json);
  }

  async getAgent(id: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }

    const json = await response.json();
    return agentSchema.parse(json);
  }

  async createAgent(userId: string, data: CreateAgentRequest): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }

    const json = await response.json();
    return agentSchema.parse(json);
  }

  async getAgentsForUser(userId: string): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/agents`);

    if (!response.ok) {
      throw new Error(`Failed to get agents: ${response.statusText}`);
    }

    const json = await response.json();
    return z.array(agentSchema).parse(json);
  }
}

// Export a singleton instance
export const userClient = new UserClient();
