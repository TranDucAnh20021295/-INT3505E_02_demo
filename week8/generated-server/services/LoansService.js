/* eslint-disable no-unused-vars */
const Service = require('./Service');
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const Counter = require('../models/Counter');

function toInt(x, d = 0) { const v = parseInt(x, 10); return Number.isNaN(v) ? d : v; }
async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return result.seq;
}

const borrowsGET = () => loansGET({});

const loansGET = ({ offset, limit, status, userUnderscoreid, bookUnderscoreid }) => new Promise(
  async (resolve, reject) => {
    try {
      offset = toInt(offset, 0);
      limit = Math.min(Math.max(toInt(limit, 10), 1), 100);
      const filter = {};
      if (status) filter.status = status;
      if (userUnderscoreid) filter.user_id = toInt(userUnderscoreid);
      if (bookUnderscoreid) filter.book_id = toInt(bookUnderscoreid);
      const sort = { id: -1 };
      const total = await Loan.countDocuments(filter);
      const items = await Loan.find(filter).sort(sort).skip(offset).limit(limit).lean();
      resolve(Service.successResponse({
        data: items,
        pagination: {
          offset,
          limit,
          total,
          pages: Math.ceil(total/limit),
          has_next: offset+limit<total,
          has_prev: offset>0,
          next_num: offset+limit<total ? Math.floor(offset/limit)+2 : null,
          prev_num: offset>0 ? Math.floor((offset-1)/limit)+1 : null,
        }
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

const loansLoanIdGET = ({ loanUnderscoreid }) => new Promise(
  async (resolve, reject) => {
    try {
      const id = toInt(loanUnderscoreid);
      const l = await Loan.findOne({ id }).lean();
      if (!l) return reject(Service.rejectResponse('Loan not found', 404));
      resolve(Service.successResponse(l));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

const loansPOST = ({ loanCreate }) => new Promise(
  async (resolve, reject) => {
    try {
      const { user_id, book_id, borrow_date, return_date } = loanCreate || {};
      if (!user_id || !book_id || !borrow_date || !return_date) {
        return reject(Service.rejectResponse('Missing fields', 400));
      }
      const book = await Book.findOne({ id: toInt(book_id) }).lean();
      if (!book) return reject(Service.rejectResponse('Book not found', 404));
      if ((book.available || 0) <= 0) return reject(Service.rejectResponse('Book not available', 409));
      const existing = await Loan.findOne({ user_id: toInt(user_id), book_id: toInt(book_id), status: 'borrowed' }).lean();
      if (existing) return reject(Service.rejectResponse('User already borrowed this book', 409));
      const id = await getNextSequence('loans');
      await Loan.create({ id, user_id: toInt(user_id), book_id: toInt(book_id), borrow_date, return_date, status: 'borrowed', actual_return_date: null });
      await Book.findOneAndUpdate({ id: toInt(book_id) }, { $inc: { available: -1 }, updated_at: new Date() });
      resolve(Service.successResponse({ message: 'Loan created successfully', id }, 201));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

const loansLoanIdReturnPUT = ({ loanUnderscoreid, returnLoan }) => new Promise(
  async (resolve, reject) => {
    try {
      const id = toInt(loanUnderscoreid);
      const l = await Loan.findOne({ id }).lean();
      if (!l) return reject(Service.rejectResponse('Loan not found', 404));
      if (l.status !== 'borrowed') return reject(Service.rejectResponse('Loan not active', 400));
      const { actual_return_date } = returnLoan || {};
      await Loan.findOneAndUpdate({ id }, { status: 'returned', actual_return_date });
      await Book.findOneAndUpdate({ id: l.book_id }, { $inc: { available: 1 }, updated_at: new Date() });
      resolve(Service.successResponse({ message: 'Loan returned successfully' }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  borrowsGET,
  loansGET,
  loansLoanIdGET,
  loansLoanIdReturnPUT,
  loansPOST,
};
