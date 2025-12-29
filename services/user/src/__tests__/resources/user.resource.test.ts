import { UserResource } from '../../private/resources/user.resource.js';
import type { UserType } from '../../public/model/userType.js';
import { NotFoundError } from '@harbor/errors';
import { createTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';

describe('UserResource', () => {
  let db: ReturnType<typeof createTestDb>;
  let userResource: UserResource;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    db = createTestDb();
    mockLogger = createMockLogger();
    userResource = new UserResource(db, mockLogger);
  });

  describe('create', () => {
    it('should create a user and return it', async () => {
      const userData = {
        name: 'Alice Smith',
        type: 'PERSONAL' as UserType,
        email: 'alice@example.com',
        phone: '+1234567890',
      };

      const user = await userResource.create(userData);

      expect(user).toMatchObject(userData);
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
    });

    it('should throw error when email is duplicate', async () => {
      const userData = {
        name: 'Bob',
        type: 'BUSINESS' as UserType,
        email: 'duplicate@example.com',
        phone: '+1111111111',
      };

      await userResource.create(userData);

      await expect(
        userResource.create({
          ...userData,
          phone: '+2222222222',
        })
      ).rejects.toThrow();
    });

    it('should throw error when phone is duplicate', async () => {
      const userData = {
        name: 'Charlie',
        type: 'PERSONAL' as UserType,
        email: 'charlie1@example.com',
        phone: '+3333333333',
      };

      await userResource.create(userData);

      await expect(
        userResource.create({
          ...userData,
          email: 'charlie2@example.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await userResource.create({
        name: 'David Lee',
        type: 'BUSINESS' as UserType,
        email: 'david@example.com',
        phone: '+4444444444',
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
      const user = await userResource.create({
        name: 'To Delete',
        type: 'PERSONAL' as UserType,
        email: 'delete@example.com',
        phone: '+5555555555',
      });

      await userResource.softDelete(user.id);

      await expect(userResource.findById(user.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('exists', () => {
    it('should return true when user exists', async () => {
      const user = await userResource.create({
        name: 'Exists',
        type: 'PERSONAL' as UserType,
        email: 'exists@example.com',
        phone: '+6666666666',
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
      const user = await userResource.create({
        name: 'Will Be Deleted',
        type: 'BUSINESS' as UserType,
        email: 'willdelete@example.com',
        phone: '+7777777777',
      });

      await userResource.softDelete(user.id);

      const exists = await userResource.exists(user.id);

      expect(exists).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      const user = await userResource.create({
        name: 'Deletable',
        type: 'PERSONAL' as UserType,
        email: 'deletable@example.com',
        phone: '+8888888888',
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
      const user = await userResource.create({
        name: 'Delete Twice',
        type: 'BUSINESS' as UserType,
        email: 'deletetwice@example.com',
        phone: '+9999999999',
      });

      await userResource.softDelete(user.id);

      await expect(userResource.softDelete(user.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
