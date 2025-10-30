/* eslint-disable no-unused-vars */
const Service = require('./Service');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');

function toInt(x, d = 1) { const v = parseInt(x, 10); return Number.isNaN(v) ? d : v; }

const searchGET = ({ q, type, page, perUnderscorepage }) => new Promise(
  async (resolve, reject) => {
    try {
      q = (q || '').trim();
      if (!q) return resolve(Service.successResponse({ query: '', entity_type: type || 'all', results: [] }));
      page = Math.max(toInt(page, 1), 1);
      perUnderscorepage = Math.min(Math.max(toInt(perUnderscorepage, 10), 1), 50);
      const skip = (page - 1) * perUnderscorepage;
      const limit = perUnderscorepage;

      let results = [];
      const doBooks = !type || type === 'all' || type === 'books';
      const doUsers = !type || type === 'all' || type === 'users';
      const doLoans = !type || type === 'all' || type === 'loans';

      if (doBooks) {
        const books = await Book.find({ $or: [ { title: { $regex: q, $options: 'i' } }, { author: { $regex: q, $options: 'i' } } ] }).skip(skip).limit(limit).lean();
        results = results.concat(books.map(b => ({ type: 'book', id: b.id, title: b.title, author: b.author, available: b.available })));
      }
      if (doUsers) {
        const users = await User.find({ $or: [ { name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } } ] }).skip(skip).limit(limit).lean();
        results = results.concat(users.map(u => ({ type: 'user', id: u.id, name: u.name, email: u.email })));
      }
      if (doLoans) {
        const loans = await Loan.find({ $or: [ { status: { $regex: q, $options: 'i' } }, { borrow_date: { $regex: q, $options: 'i' } }, { return_date: { $regex: q, $options: 'i' } } ] }).skip(skip).limit(limit).lean();
        results = results.concat(loans.map(l => ({ type: 'loan', id: l.id, status: l.status, borrow_date: l.borrow_date, user_id: l.user_id, book_id: l.book_id })));
      }

      resolve(Service.successResponse({ query: q, entity_type: type || 'all', results }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  searchGET,
};
