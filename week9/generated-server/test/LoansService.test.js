const { expect } = require('chai');
const {
  loansGET,
  loansPOST,
  loansLoanIdReturnPUT
} = require('../services/LoansService');
const { setupTestDB, cleanupTestDB, closeTestDB, createTestUser, createTestBook, createTestLoan } = require('./setup');
const Counter = require('../models/Counter');

describe('LoansService', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanupTestDB();
    await Counter.create({ _id: 'loans', seq: 0 });
    await Counter.create({ _id: 'users', seq: 0 });
    await Counter.create({ _id: 'books', seq: 0 });
  });

  after(async () => {
    await closeTestDB();
  });

  describe('loansGET', () => {
    it('should return list of loans', async () => {
      await createTestLoan({ id: 1, user_id: 1, book_id: 1, status: 'borrowed' });
      const result = await loansGET({});
      expect(result.code).to.equal(200);
      expect(result.payload.data).to.be.an('array');
    });
  });

  describe('loansPOST', () => {
    beforeEach(async () => {
      await createTestUser({ id: 1, name: 'Test User', email: 'test@example.com' });
      await createTestBook({ id: 1, title: 'Test Book', available: 1 });
    });

    it('should create a new loan', async () => {
      const result = await loansPOST({
        user_id: 1,
        book_id: 1,
        borrow_date: '2024-01-01',
        return_date: '2024-01-15'
      });
      expect(result.code).to.equal(201);
    });
  });

  describe('loansLoanIdReturnPUT', () => {
    beforeEach(async () => {
      await createTestBook({ id: 1, title: 'Test Book', available: 0 });
      await createTestLoan({ id: 1, user_id: 1, book_id: 1, status: 'borrowed' });
    });

    it('should return loan', async () => {
      const result = await loansLoanIdReturnPUT({
        loanUnderscoreid: 1,
        returnLoan: { actual_return_date: '2024-01-10' }
      });
      expect(result.code).to.equal(200);
    });
  });
});

