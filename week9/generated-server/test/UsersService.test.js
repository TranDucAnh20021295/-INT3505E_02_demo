const { expect } = require('chai');
const { usersGET } = require('../services/UsersService');
const { setupTestDB, cleanupTestDB, closeTestDB, createTestUser } = require('./setup');

describe('UsersService', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanupTestDB();
  });

  after(async () => {
    await closeTestDB();
  });

  describe('usersGET', () => {
    it('should return list of users', async () => {
      await createTestUser({ id: 1, name: 'User 1', email: 'user1@example.com' });
      const result = await usersGET({});
      expect(result.code).to.equal(200);
      expect(result.payload.data).to.be.an('array');
    });
  });
});
