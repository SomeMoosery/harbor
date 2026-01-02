import { AskResource } from '../../private/resources/ask.resource.js';
import type { AskStatus } from '../../public/model/askStatus.js';
import { NotFoundError } from '@harbor/errors';
import { createTestDb, closeTestDb, cleanTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';
import type { Sql } from 'postgres';

describe('AskResource', () => {
  let sql: Sql;
  let askResource: AskResource;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeAll(async () => {
    sql = await createTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    mockLogger = createMockLogger();
    askResource = new AskResource(sql, mockLogger);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('create', () => {
    it('should create an ask and return it', async () => {
      const askData = {
        title: 'Need a Web Scraper',
        description: 'Build a web scraper for e-commerce sites',
        requirements: { language: 'Python', framework: 'Scrapy' },
        minBudget: 500,
        maxBudget: 1000,
        createdBy: 'agent-123',
      };

      const ask = await askResource.create(askData);

      expect(ask).toMatchObject({
        title: askData.title,
        description: askData.description,
        requirements: askData.requirements,
        minBudget: askData.minBudget,
        maxBudget: askData.maxBudget,
        createdBy: askData.createdBy,
        status: 'OPEN',
      });
      expect(ask.id).toBeDefined();
      expect(typeof ask.id).toBe('string');
    });

    it('should create ask with budget flexibility', async () => {
      const askData = {
        title: 'Mobile App',
        description: 'Build a mobile app',
        requirements: { platform: 'iOS' },
        minBudget: 5000,
        maxBudget: 10000,
        budgetFlexibilityAmount: 2000,
        createdBy: 'agent-456',
      };

      const ask = await askResource.create(askData);

      expect(ask.budgetFlexibilityAmount).toBe(2000);
    });

    it('should default status to OPEN', async () => {
      const ask = await askResource.create({
        title: 'Test Ask',
        description: 'Testing',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'agent-789',
      });

      expect(ask.status).toBe('OPEN');
    });
  });

  describe('findById', () => {
    it('should find ask by id', async () => {
      const created = await askResource.create({
        title: 'Data Analysis',
        description: 'Analyze sales data',
        requirements: { tool: 'Excel' },
        minBudget: 300,
        maxBudget: 500,
        createdBy: 'agent-123',
      });

      const found = await askResource.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        title: created.title,
        description: created.description,
      });
    });

    it('should throw NotFoundError when ask does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(askResource.findById(fakeId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create multiple asks with different statuses
      await askResource.create({
        title: 'Ask 1',
        description: 'First ask',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'agent-1',
      });

      const ask2 = await askResource.create({
        title: 'Ask 2',
        description: 'Second ask',
        requirements: {},
        minBudget: 300,
        maxBudget: 400,
        createdBy: 'agent-2',
      });

      await askResource.updateStatus(ask2.id, 'IN_PROGRESS');

      await askResource.create({
        title: 'Ask 3',
        description: 'Third ask',
        requirements: {},
        minBudget: 500,
        maxBudget: 600,
        createdBy: 'agent-1',
      });
    });

    it('should retrieve all asks without filters', async () => {
      const asks = await askResource.findAll();

      expect(asks).toHaveLength(3);
    });

    it('should filter asks by status', async () => {
      const openAsks = await askResource.findAll({ status: 'OPEN' });

      expect(openAsks).toHaveLength(2);
      expect(openAsks.every(ask => ask.status === 'OPEN')).toBe(true);
    });

    it('should filter asks by createdBy', async () => {
      const agent1Asks = await askResource.findAll({ createdBy: 'agent-1' });

      expect(agent1Asks).toHaveLength(2);
      expect(agent1Asks.every(ask => ask.createdBy === 'agent-1')).toBe(true);
    });

    it('should filter by both status and createdBy', async () => {
      const filtered = await askResource.findAll({
        status: 'OPEN',
        createdBy: 'agent-1',
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(ask => ask.status === 'OPEN' && ask.createdBy === 'agent-1')).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('should update ask status successfully', async () => {
      const ask = await askResource.create({
        title: 'Update Test',
        description: 'Testing status update',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'agent-123',
      });

      const updated = await askResource.updateStatus(ask.id, 'IN_PROGRESS');

      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.id).toBe(ask.id);
    });

    it('should update from IN_PROGRESS to COMPLETED', async () => {
      const ask = await askResource.create({
        title: 'Complete Test',
        description: 'Testing completion',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'agent-123',
      });

      await askResource.updateStatus(ask.id, 'IN_PROGRESS');
      const completed = await askResource.updateStatus(ask.id, 'COMPLETED');

      expect(completed.status).toBe('COMPLETED');
    });

    it('should throw NotFoundError for non-existent ask', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        askResource.updateStatus(fakeId, 'COMPLETED')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
