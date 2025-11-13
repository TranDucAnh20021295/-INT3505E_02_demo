const { expect } = require('chai');
const { loginPOST, registerPOST } = require('../services/AuthenticationService');
const { setupTestDB, cleanupTestDB, closeTestDB, createTestUser } = require('./setup');
const { hashPassword } = require('./helpers');
const Counter = require('../models/Counter');

describe('AuthenticationService', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanupTestDB();
    await Counter.create({ _id: 'users', seq: 0 });
  });

  after(async () => {
    await closeTestDB();
  });

  describe('registerPOST', () => {
    it('should register a new user', async () => {
      const result = await registerPOST({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      });
      
      expect(result.code).to.equal(201);
      expect(result.payload.message).to.equal('User registered successfully');
    });

    it('should reject registration with missing fields', async () => {
      try {
        await registerPOST({ email: 'john@example.com' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal(400);
      }
    });
  });

  describe('loginPOST', () => {
    beforeEach(async () => {
      const userId = 1;
      const password = 'password123';
      const salt = String(userId);
      const passwordHash = hashPassword(password, salt);
      
      await createTestUser({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        password_hash: passwordHash
      });
    });

    it('should login successfully', async () => {
      const result = await loginPOST({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(result.code).to.equal(200);
      expect(result.payload.token).to.be.a('string');
    });

    it('should reject login with wrong password', async () => {
      try {
        await loginPOST({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal(401);
      }
    });
  });
});
