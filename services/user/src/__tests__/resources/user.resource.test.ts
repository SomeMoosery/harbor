import { UserResource } from '../../private/resources/user.resource.js';
import { NotFoundError } from '@harbor/errors';
import { createTestDb, closeTestDb, cleanTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';
import type { Sql } from 'postgres';

describe('UserResource', () => {
  let sql: Sql;
  let userResource: UserResource;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeAll(async () => {
    sql = await createTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    mockLogger = createMockLogger();
    userResource = new UserResource(sql, mockLogger);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('createFromOAuth', () => {
    it('should create a user and return it', async () => {
      const userData = {
        name: 'Alice Smith',
        email: 'alice@example.com',
        googleId: 'google-alice-123',
      };

      const user = await userResource.createFromOAuth(userData);

      expect(user).toMatchObject({
        name: userData.name,
        email: userData.email,
        googleId: userData.googleId,
        userType: 'UNKNOWN',
        subType: 'PERSONAL',
        onboardingCompleted: false,
      });
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
    });

    it('should throw error when email is duplicate', async () => {
      const userData = {
        name: 'Bob',
        email: 'duplicate@example.com',
        googleId: 'google-bob-123',
      };

      await userResource.createFromOAuth(userData);

      await expect(
        userResource.createFromOAuth({
          ...userData,
          googleId: 'google-bob-456',
        })
      ).rejects.toThrow();
    });

    it('should throw error when googleId is duplicate', async () => {
      const userData = {
        name: 'Charlie',
        email: 'charlie1@example.com',
        googleId: 'google-charlie-123',
      };

      await userResource.createFromOAuth(userData);

      await expect(
        userResource.createFromOAuth({
          ...userData,
          email: 'charlie2@example.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await userResource.createFromOAuth({
        name: 'David Lee',
        email: 'david@example.com',
        googleId: 'google-david-123',
      });

      const found = await userResource.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        name: created.name,
        email: created.email,
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(userResource.findById(fakeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError for soft-deleted user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'To Delete',
        email: 'delete@example.com',
        googleId: 'google-delete-123',
      });

      await userResource.softDelete(user.id);

      await expect(userResource.findById(user.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('findByGoogleId', () => {
    it('should find user by Google ID', async () => {
      const created = await userResource.createFromOAuth({
        name: 'Emily',
        email: 'emily@example.com',
        googleId: 'google-emily-123',
      });

      const found = await userResource.findByGoogleId('google-emily-123');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.email).toBe('emily@example.com');
    });

    it('should return null when Google ID does not exist', async () => {
      const found = await userResource.findByGoogleId('nonexistent-google-id');

      expect(found).toBeNull();
    });

    it('should return null for soft-deleted user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Frank',
        email: 'frank@example.com',
        googleId: 'google-frank-123',
      });

      await userResource.softDelete(user.id);

      const found = await userResource.findByGoogleId('google-frank-123');

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const created = await userResource.createFromOAuth({
        name: 'Grace',
        email: 'grace@example.com',
        googleId: 'google-grace-123',
      });

      const found = await userResource.findByEmail('grace@example.com');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Grace');
    });

    it('should return null when email does not exist', async () => {
      const found = await userResource.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });

    it('should return null for soft-deleted user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Henry',
        email: 'henry@example.com',
        googleId: 'google-henry-123',
      });

      await userResource.softDelete(user.id);

      const found = await userResource.findByEmail('henry@example.com');

      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when user exists', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Exists',
        email: 'exists@example.com',
        googleId: 'google-exists-123',
      });

      const exists = await userResource.exists(user.id);

      expect(exists).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const exists = await userResource.exists(fakeId);

      expect(exists).toBe(false);
    });

    it('should return false for soft-deleted user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Will Be Deleted',
        email: 'willdelete@example.com',
        googleId: 'google-willdelete-123',
      });

      await userResource.softDelete(user.id);

      const exists = await userResource.exists(user.id);

      expect(exists).toBe(false);
    });
  });

  describe('updateUserType', () => {
    it('should update user type and sub-type', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Ivan',
        email: 'ivan@example.com',
        googleId: 'google-ivan-123',
      });

      const updated = await userResource.updateUserType(user.id, 'HUMAN', 'BUSINESS');

      expect(updated.userType).toBe('HUMAN');
      expect(updated.subType).toBe('BUSINESS');
      expect(updated.onboardingCompleted).toBe(true);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        userResource.updateUserType(fakeId, 'HUMAN', 'PERSONAL')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Deletable',
        email: 'deletable@example.com',
        googleId: 'google-deletable-123',
      });

      await userResource.softDelete(user.id);

      const exists = await userResource.exists(user.id);
      expect(exists).toBe(false);
    });

    it('should throw NotFoundError when deleting non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(userResource.softDelete(fakeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when deleting already deleted user', async () => {
      const user = await userResource.createFromOAuth({
        name: 'Delete Twice',
        email: 'deletetwice@example.com',
        googleId: 'google-deletetwice-123',
      });

      await userResource.softDelete(user.id);

      await expect(userResource.softDelete(user.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
