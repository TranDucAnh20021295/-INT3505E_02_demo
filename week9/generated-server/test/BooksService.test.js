const { expect } = require('chai');
const {
  booksGET,
  booksIdGET,
  booksPOST,
  booksIdPUT,
  booksIdDELETE
} = require('../services/BooksService');
const { setupTestDB, cleanupTestDB, closeTestDB, createTestBook } = require('./setup');
const Counter = require('../models/Counter');

describe('BooksService', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanupTestDB();
    await Counter.create({ _id: 'books', seq: 0 });
  });

  after(async () => {
    await closeTestDB();
  });

  describe('booksGET', () => {
    it('should return list of books', async () => {
      await createTestBook({ id: 1, title: 'Book 1', author: 'Author 1' });
      const result = await booksGET({});
      expect(result.code).to.equal(200);
      expect(result.payload.data).to.be.an('array');
    });
  });

  describe('booksIdGET', () => {
    it('should return book by id', async () => {
      await createTestBook({ id: 1, title: 'Test Book', author: 'Test Author' });
      const result = await booksIdGET({ id: 1 });
      expect(result.code).to.equal(200);
      expect(result.payload.id).to.equal(1);
    });
  });

  describe('booksPOST', () => {
    it('should create a new book', async () => {
      const result = await booksPOST({
        title: 'New Book',
        author: 'New Author'
      });
      expect(result.code).to.equal(200);
      expect(result.payload.id).to.be.a('number');
    });
  });

  describe('booksIdPUT', () => {
    it('should update book', async () => {
      await createTestBook({ id: 1, title: 'Original Title', author: 'Original Author' });
      const result = await booksIdPUT({
        id: 1,
        bookUpdate: { title: 'Updated Title' }
      });
      expect(result.code).to.equal(200);
    });
  });

  describe('booksIdDELETE', () => {
    it('should delete book', async () => {
      await createTestBook({ id: 1, title: 'Book to Delete', author: 'Author' });
      const result = await booksIdDELETE({ id: 1 });
      expect(result.code).to.equal(200);
    });
  });
});
