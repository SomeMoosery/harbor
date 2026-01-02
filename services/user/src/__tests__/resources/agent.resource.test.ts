import { AgentResource } from '../../private/resources/agent.resource.js';
import { UserResource } from '../../private/resources/user.resource.js';
import type { AgentType } from '../../public/model/agentType.js';
import type { UserType } from '../../public/model/userType.js';
import { NotFoundError } from '@harbor/errors';
import { createTestDb, closeTestDb, cleanTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';
import type { Sql } from 'postgres';

describe('AgentResource', () => {
  let sql: Sql;
  let agentResource: AgentResource;
  let userResource: UserResource;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let testUserId: string;

  beforeAll(async () => {
    sql = await createTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    mockLogger = createMockLogger();
    agentResource = new AgentResource(sql, mockLogger);
    userResource = new UserResource(sql, mockLogger);

    // Create a test user for agent relationships
    const user = await userResource.create({
      name: 'Test User',
      type: 'BUSINESS' as UserType,
      email: 'test@example.com',
      phone: '+1234567890',
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('create', () => {
    it('should create an agent and return it', async () => {
      const agentData = {
        userId: testUserId,
        name: 'Trading Agent',
        capabilities: { trading: true, analysis: false },
        type: 'BUYER' as AgentType,
      };

      const agent = await agentResource.create(agentData);

      expect(agent).toMatchObject(agentData);
      expect(agent.id).toBeDefined();
      expect(typeof agent.id).toBe('string');
    });

    it('should handle complex capabilities object', async () => {
      const complexCapabilities = {
        trading: {
          stocks: true,
          crypto: false,
        },
        limits: {
          maxAmount: 10000,
          currency: 'USD',
        },
        features: ['auto-trade', 'stop-loss'],
      };

      const agent = await agentResource.create({
        userId: testUserId,
        name: 'Complex Agent',
        capabilities: complexCapabilities,
        type: 'DUAL' as AgentType,
      });

      expect(agent.capabilities).toEqual(complexCapabilities);
    });

    it('should throw error when userId references non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        agentResource.create({
          userId: fakeUserId,
          name: 'Orphan Agent',
          capabilities: {},
          type: 'SELLER' as AgentType,
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find agent by id', async () => {
      const created = await agentResource.create({
        userId: testUserId,
        name: 'Findable Agent',
        capabilities: { feature: 'value' },
        type: 'BUYER' as AgentType,
      });

      const found = await agentResource.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        userId: created.userId,
        name: created.name,
        type: created.type,
      });
    });

    it('should throw NotFoundError when agent does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(agentResource.findById(fakeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError for soft-deleted agent', async () => {
      const agent = await agentResource.create({
        userId: testUserId,
        name: 'Will Be Deleted',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      await agentResource.softDeleteByUserId(testUserId);

      await expect(agentResource.findById(agent.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('findByUserId', () => {
    it('should find all agents for a user', async () => {
      await agentResource.create({
        userId: testUserId,
        name: 'Agent 1',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await agentResource.create({
        userId: testUserId,
        name: 'Agent 2',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      const agents = await agentResource.findByUserId(testUserId);

      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.name).sort()).toEqual(['Agent 1', 'Agent 2']);
    });

    it('should return empty array when user has no agents', async () => {
      const agents = await agentResource.findByUserId(testUserId);

      expect(agents).toEqual([]);
    });

    it('should not return soft-deleted agents', async () => {
      await agentResource.create({
        userId: testUserId,
        name: 'Agent 1',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await agentResource.softDeleteByUserId(testUserId);

      const agents = await agentResource.findByUserId(testUserId);

      expect(agents).toEqual([]);
    });

    it('should only return agents for specified user', async () => {
      const user2 = await userResource.create({
        name: 'Another User',
        type: 'PERSONAL' as UserType,
        email: 'another@example.com',
        phone: '+0987654321',
      });

      await agentResource.create({
        userId: testUserId,
        name: 'User 1 Agent',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await agentResource.create({
        userId: user2.id,
        name: 'User 2 Agent',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      const user1Agents = await agentResource.findByUserId(testUserId);
      const user2Agents = await agentResource.findByUserId(user2.id);

      expect(user1Agents).toHaveLength(1);
      expect(user2Agents).toHaveLength(1);
      expect(user1Agents[0].name).toBe('User 1 Agent');
      expect(user2Agents[0].name).toBe('User 2 Agent');
    });
  });

  describe('updateType', () => {
    it('should update agent type', async () => {
      const agent = await agentResource.create({
        userId: testUserId,
        name: 'Mutable Agent',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      const updated = await agentResource.updateType(agent.id, 'DUAL' as AgentType);

      expect(updated.type).toBe('DUAL' as AgentType);
      expect(updated.id).toBe(agent.id);
    });

    it('should throw NotFoundError when agent does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        agentResource.updateType(fakeId, 'SELLER' as AgentType)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when updating soft-deleted agent', async () => {
      const agent = await agentResource.create({
        userId: testUserId,
        name: 'Will Delete',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      await agentResource.softDeleteByUserId(testUserId);

      await expect(
        agentResource.updateType(agent.id, 'SELLER' as AgentType)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDeleteByUserId', () => {
    it('should soft delete all agents for a user', async () => {
      const agent1 = await agentResource.create({
        userId: testUserId,
        name: 'Agent 1',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      const agent2 = await agentResource.create({
        userId: testUserId,
        name: 'Agent 2',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      await agentResource.softDeleteByUserId(testUserId);

      await expect(agentResource.findById(agent1.id)).rejects.toThrow(
        NotFoundError
      );
      await expect(agentResource.findById(agent2.id)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should only delete agents for specified user', async () => {
      const user2 = await userResource.create({
        name: 'User 2',
        type: 'PERSONAL' as UserType,
        email: 'user2@example.com',
        phone: '+2222222222',
      });

      const agent1 = await agentResource.create({
        userId: testUserId,
        name: 'User 1 Agent',
        capabilities: {},
        type: 'BUYER' as AgentType,
      });

      const agent2 = await agentResource.create({
        userId: user2.id,
        name: 'User 2 Agent',
        capabilities: {},
        type: 'SELLER' as AgentType,
      });

      await agentResource.softDeleteByUserId(testUserId);

      await expect(agentResource.findById(agent1.id)).rejects.toThrow(
        NotFoundError
      );

      const stillExists = await agentResource.findById(agent2.id);
      expect(stillExists.id).toBe(agent2.id);
    });

    it('should not throw error when user has no agents', async () => {
      await expect(
        agentResource.softDeleteByUserId(testUserId)
      ).resolves.not.toThrow();
    });
  });
});
