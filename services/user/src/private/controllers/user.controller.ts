import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { UserManager } from '../managers/user.manager.js';
import { CreateUserRequest } from '../../public/request/createUserRequest.js';
import { CreateAgentRequest } from '../../public/request/createAgentRequest.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * Controller handles HTTP request/response formatting
 */
export class UserController {
  constructor(
    private readonly manager: UserManager,
    private readonly logger: Logger
  ) {}

  async createUser(c: Context) {
    try {
      const body: CreateUserRequest = await c.req.json();
      const user = await this.manager.createUser(body);

      return c.json(user, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getUser(c: Context) {
    try {
      const id = c.req.param('id');
      const user = await this.manager.getUser(id);

      return c.json(user);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createAgent(c: Context) {
    try {
      const userId = c.req.param('userId');
      const body: CreateAgentRequest = await c.req.json();

      const agent = await this.manager.createAgent({
        userId,
        ...body,
      });

      return c.json(agent, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getAgentsForUser(c: Context) {
    try {
      const userId = c.req.param('userId');
      const agents = await this.manager.getAgentsForUser(userId);

      return c.json(agents);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }
}
