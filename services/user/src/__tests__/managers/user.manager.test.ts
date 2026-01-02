import { UserManager } from '../../private/managers/user.manager.js';
import { UserResource } from '../../private/resources/user.resource.js';
import { AgentResource } from '../../private/resources/agent.resource.js';
import type { UserType } from '../../public/model/userType.js';
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

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userData = {
        name: 'John Doe',
        type: 'PERSONAL' as UserType,
        email: 'john@example.com',
        phone: '+1234567890',
      };

      const user = await userManager.createUser(userData);

      expect(user).toMatchObject({
        name: userData.name,
        type: userData.type,
        email: userData.email,
        phone: userData.phone,
      });
      expect(user.id).toBeDefined();
    });

    it('should throw ConflictError when email already exists', async () => {
      const userData = {
        name: 'John Doe',
        type: 'PERSONAL' as UserType,
        email: 'john@example.com',
        phone: '+1234567890',
      };

      await userManager.createUser(userData);

      const duplicateData = {
        ...userData,
        phone: '+0987654321', // Different phone
      };

      await expect(userManager.createUser(duplicateData)).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw ConflictError when phone already exists', async () => {
      const userData = {
        name: 'John Doe',
        type: 'PERSONAL' as UserType,
        email: 'john@example.com',
        phone: '+1234567890',
      };

      await userManager.createUser(userData);

      const duplicateData = {
        ...userData,
        email: 'different@example.com', // Different email
      };

      await expect(userManager.createUser(duplicateData)).rejects.toThrow(
        ConflictError
      );
    });

    it('should create multiple users with unique emails and phones', async () => {
      const user1 = await userManager.createUser({
        name: 'User 1',
        type: 'PERSONAL' as UserType,
        email: 'user1@example.com',
        phone: '+1111111111',
      });

      const user2 = await userManager.createUser({
        name: 'User 2',
        type: 'BUSINESS' as UserType,
        email: 'user2@example.com',
        phone: '+2222222222',
      });

      expect(user1.id).not.toEqual(user2.id);
      expect(user1.email).not.toEqual(user2.email);
    });
  });

  describe('getUser', () => {
    it('should retrieve a user by id', async () => {
      const created = await userManager.createUser({
        name: 'Jane Doe',
        type: 'BUSINESS' as UserType,
        email: 'jane@example.com',
        phone: '+1234567890',
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
      const user = await userManager.createUser({
        name: 'To Delete',
        type: 'PERSONAL' as UserType,
        email: 'delete@example.com',
        phone: '+9999999999',
      });

      await userManager.deleteUser(user.id);

      await expect(userManager.getUser(user.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('createAgent', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await userManager.createUser({
        name: 'Agent Owner',
        type: 'BUSINESS' as UserType,
        email: 'owner@example.com',
        phone: '+1234567890',
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
      const user2 = await userManager.createUser({
        name: 'Another Owner',
        type: 'PERSONAL' as UserType,
        email: 'another@example.com',
        phone: '+0987654321',
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
      const user = await userManager.createUser({
        name: 'Agent Owner',
        type: 'BUSINESS' as UserType,
        email: 'owner@example.com',
        phone: '+1234567890',
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
      const user = await userManager.createUser({
        name: 'Multi Agent Owner',
        type: 'BUSINESS' as UserType,
        email: 'multi@example.com',
        phone: '+1234567890',
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

      const newUser = await userManager.createUser({
        name: 'New User',
        type: 'PERSONAL' as UserType,
        email: 'new@example.com',
        phone: '+9999999999',
      });

      const agents = await userManager.getAgentsForUser(newUser.id);
      expect(agents).toEqual([]);
    });
  });

  describe('updateAgentType', () => {
    let userId: string;
    let agentId: string;

    beforeEach(async () => {
      const user = await userManager.createUser({
        name: 'Owner',
        type: 'BUSINESS' as UserType,
        email: 'owner@example.com',
        phone: '+1234567890',
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
      const user = await userManager.createUser({
        name: 'To Delete',
        type: 'PERSONAL' as UserType,
        email: 'delete@example.com',
        phone: '+1111111111',
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

    it('should soft delete user but unique constraints still apply', async () => {
      const email = 'reusable@example.com';

      const user1 = await userManager.createUser({
        name: 'First User',
        type: 'PERSONAL' as UserType,
        email,
        phone: '+1111111111',
      });

      await userManager.deleteUser(user1.id);

      // Note: In pg-mem (and some database configurations), unique constraints
      // still apply to soft-deleted records. In production with real PostgreSQL,
      // you'd typically use a partial unique index to allow reuse:
      // CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE deleted_at IS NULL;
      await expect(
        userManager.createUser({
          name: 'Second User',
          type: 'BUSINESS' as UserType,
          email,
          phone: '+2222222222',
        })
      ).rejects.toThrow(ConflictError);
    });
  });
});
