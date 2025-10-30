/* eslint-disable no-unused-vars */
const Service = require('./Service');
const Book = require('../models/Book');
const Counter = require('../models/Counter');

// Hàm sinh id tự động tăng
toSafeInt = (x, d=0) => { const v = parseInt(x,10); return isNaN(v)?d:v }
async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return result.seq;
}

// List books (GET /books)
const booksGET = ({ offset, limit }) => new Promise(
  async (resolve, reject) => {
    try {
      offset = toSafeInt(offset, 0);
      limit = Math.min(Math.max(toSafeInt(limit, 10), 1), 100);
      const filter = {};
      const sort = { id: 1 };
      const total = await Book.countDocuments(filter);
      const items = await Book.find(filter).sort(sort).skip(offset).limit(limit).lean();
      const data = items.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        available: b.available,
        updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : null,
      }));
      resolve(Service.successResponse({
        data,
        pagination: {
          offset,
          limit,
          total,
          pages: Math.ceil(total/limit),
          has_next: offset+limit < total,
          has_prev: offset > 0,
          next_num: offset+limit < total ? Math.floor(offset/limit)+2 : null,
          prev_num: offset > 0 ? Math.floor((offset-1)/limit)+1 : null,
        }
      }))
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Failed to list books',
        e.status || 500,
      ));
    }
  }
);
// Get book by ID
const booksIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const safeId = toSafeInt(id);
      if (isNaN(safeId)) throw new Error('Invalid book ID');
      const b = await Book.findOne({ id: safeId }).lean();
      if (!b) return reject(Service.rejectResponse('Book not found', 404));
      resolve(Service.successResponse({
        id: b.id, title: b.title, author: b.author, available: b.available, updated_at: b.updated_at
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Failed to get book', e.status || 500));
    }
  }
);
// Create new book
const booksPOST = ({ bookCreate }) => new Promise(
  async (resolve, reject) => {
    try {
      const { title, author } = bookCreate || {};
      if (!title || !author) throw new Error('title and author are required');
      const id = await getNextSequence('books');
      const created = await Book.create({ id, title, author, available: 1, updated_at: new Date() });
      resolve(Service.successResponse({ message: 'Book created', id: created.id }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Failed to create book', e.status || 500));
    }
  }
);
// Update book by ID
const booksIdPUT = ({ id, bookUpdate }) => new Promise(
  async (resolve, reject) => {
    try {
      const safeId = toSafeInt(id);
      if (isNaN(safeId)) throw new Error('Invalid book ID');
      const update = { ...bookUpdate, updated_at: new Date() };
      const updated = await Book.findOneAndUpdate({ id: safeId }, update, { new: true }).lean();
      if (!updated) return reject(Service.rejectResponse('Book not found', 404));
      resolve(Service.successResponse({ message: 'Book updated' }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Failed to update book', e.status || 500));
    }
  }
);
// Delete book by ID
const booksIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const safeId = toSafeInt(id);
      if (isNaN(safeId)) throw new Error('Invalid book ID');
      const deleted = await Book.findOneAndDelete({ id: safeId }).lean();
      if (!deleted) return reject(Service.rejectResponse('Book not found', 404));
      resolve(Service.successResponse({ message: 'Book deleted' }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Failed to delete book', e.status || 500));
    }
  }
);

module.exports = {
  booksGET,
  booksIdDELETE,
  booksIdGET,
  booksIdPUT,
  booksPOST,
};
