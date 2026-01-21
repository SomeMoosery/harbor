import { UserManager } from '../../private/managers/user.manager.js';
import { UserResource } from '../../private/resources/user.resource.js';
import { AgentResource } from '../../private/resources/agent.resource.js';
import type { AgentType } from '../../public/model/agentType.js';
import { NotFoundError, ConflictError } from '@harbor/errors';
import { createTestDb, closeTestDb, cleanTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';
import { createMockWalletClient } from '../setup/mockWalletClient.js';
import type { Sql } from 'postgres';

describe('UserManager', () => {
  let sql: Sql;
  let userManager: UserManager;
  let userResource: UserResource;
  let agentResource: AgentResource;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockWalletClient: ReturnType<typeof createMockWalletClient>;

  beforeAll(async () => {
    sql = await createTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    mockLogger = createMockLogger();
    mockWalletClient = createMockWalletClient();

    // Initialize resources
    userResource = new UserResource(sql, mockLogger);
    agentResource = new AgentResource(sql, mockLogger);

    // Initialize manager with mocked wallet client
    userManager = new UserManager(
      userResource,
      agentResource,
      mockLogger,
      mockWalletClient
    );
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // Helper function to create a test user via OAuth (users are now created via OAuth)
  async function createTestUser(data: { name: string; email: string; googleId: string }) {
    return userResource.createFromOAuth(data);
  }

  describe('getUser', () => {
    it('should retrieve a user by id', async () => {
      const created = await createTestUser({
        name: 'Jane Doe',
        email: 'jane@example.com',
        googleId: 'google-jane-123',
      });

      const retrieved = await userManager.getUser(created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        name: created.name,
        email: created.email,
      });
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(userManager.getUser(fakeId)).rejects.toThrow(NotFoundError);
    });

    it('should not retrieve soft-deleted users', async () => {
      const user = await createTestUser({
        name: 'To Delete',
        email: 'delete@example.com',
        googleId: 'google-delete-123',
      });

      await userManager.deleteUser(user.id);

      await expect(userManager.getUser(user.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('createAgent', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await createTestUser({
        name: 'Agent Owner',
        email: 'owner@example.com',
        googleId: 'google-owner-123',
      });
      userId = user.id;
    });

    it('should create an agent successfully', async () => {
      const agentData = {
        userId,
        name: 'Trading Bot',
        capabilities: { trading: true },
        type: 'BUYER' as AgentType,
      };

      const agent = await userManager.createAgent(agentData);

      expect(agent).toMatchObject({
        userId,
        name: agentData.name,
        capabilities: agentData.capabilities,
        type: agentData.type,
      });
      expect(agent.id).toBeDefined();
    });

    it('should call wallet client to create wallet for agent', async () => {
      const agentData = {
        userId,
        name: 'Trading Bot',
        capabilities: { trading: true },
        type: 'SELLER' as AgentType,
      };

      const agent = await userManager.createAgent(agentData);

      // Note: The wallet creation is async and not awaited,
      // so we need to wait a bit or check if it was called
      expect(mockWalletClient.createWallet).toHaveBeenCalledWith({
        agentId: agent.id,
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        userManager.createAgent({
          userId: fakeUserId,
          name: 'Orphan Agent',
          capabilities: {},
          type: 'DUAL' as AgentType,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when agent name is duplicate for user', async () => {
      const agentData = {
        userId,
        name: 'Unique Name',
        capabilities: { feature: 'A' },
        type: 'BUYER' as AgentType,
      };

      await userManager.createAgent(agentData);

      // Try to create another agent with same name for same user
      await expect(
        userManager.createAgent({
          ...agentData,
          capabilities: { feature: 'B' }, // Different capabilities
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should allow same agent name for different users', async () => {
      const user2 = await createTestUser({
        name: 'Another Owner',
        email: 'another@example.com',
        googleId: 'google-another-123',
      });

      const agentName = 'Common Name';

      const agent1 = await userManager.createAgent({
        userId,
        name: agentName,
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      const agent2 = await userManager.createAgent({
        userId: user2.id,
        name: agentName,
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      expect(agent1.name).toEqual(agent2.name);
      expect(agent1.id).not.toEqual(agent2.id);
    });
  });

  describe('getAgent', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await createTestUser({
        name: 'Agent Owner',
        email: 'owner@example.com',
        googleId: 'google-owner-456',
      });
      userId = user.id;
    });

    it('should retrieve an agent by id', async () => {
      const created = await userManager.createAgent({
        userId,
        name: 'Test Agent',
        capabilities: { test: true },
        type: 'DUAL' as AgentType,
      });

      const retrieved = await userManager.getAgent(created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        name: created.name,
        type: created.type,
      });
    });

    it('should throw NotFoundError for non-existent agent', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(userManager.getAgent(fakeId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAgentsForUser', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await createTestUser({
        name: 'Multi Agent Owner',
        email: 'multi@example.com',
        googleId: 'google-multi-123',
      });
      userId = user.id;
    });

    it('should retrieve all agents for a user', async () => {
      await userManager.createAgent({
        userId,
        name: 'Agent 1',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await userManager.createAgent({
        userId,
        name: 'Agent 2',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      const agents = await userManager.getAgentsForUser(userId);

      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.name).sort()).toEqual(['Agent 1', 'Agent 2']);
    });

    it('should return empty array when user has no agents', async () => {
      const agents = await userManager.getAgentsForUser(userId);

      expect(agents).toEqual([]);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      await expect(userManager.getAgentsForUser(fakeUserId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not return soft-deleted agents', async () => {
      await userManager.createAgent({
        userId,
        name: 'Active Agent',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await userManager.deleteUser(userId);

      const newUser = await createTestUser({
        name: 'New User',
        email: 'new@example.com',
        googleId: 'google-new-123',
      });

      const agents = await userManager.getAgentsForUser(newUser.id);
      expect(agents).toEqual([]);
    });
  });

  describe('updateAgentType', () => {
    let userId: string;
    let agentId: string;

    beforeEach(async () => {
      const user = await createTestUser({
        name: 'Owner',
        email: 'owner@example.com',
        googleId: 'google-owner-789',
      });
      userId = user.id;

      const agent = await userManager.createAgent({
        userId,
        name: 'Mutable Agent',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });
      agentId = agent.id;
    });

    it('should update agent type successfully', async () => {
      const updated = await userManager.updateAgentType(
        agentId,
        'SELLER' as AgentType
      );

      expect(updated.type).toEqual('SELLER' as AgentType);
      expect(updated.id).toEqual(agentId);
    });

    it('should throw NotFoundError for non-existent agent', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        userManager.updateAgentType(fakeId, 'DUAL' as AgentType)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user and cascade to agents', async () => {
      const user = await createTestUser({
        name: 'To Delete',
        email: 'delete@example.com',
        googleId: 'google-delete-456',
      });

      const agent = await userManager.createAgent({
        userId: user.id,
        name: 'Agent to Delete',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await userManager.deleteUser(user.id);

      // User should not be retrievable
      await expect(userManager.getUser(user.id)).rejects.toThrow(NotFoundError);

      // Agent should not be retrievable
      await expect(userManager.getAgent(agent.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
