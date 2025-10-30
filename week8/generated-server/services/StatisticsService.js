/* eslint-disable no-unused-vars */
const Service = require('./Service');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');

const statsGET = () => new Promise(
  async (resolve, reject) => {
    try {
      const [booksTotal, booksAgg, usersTotal, loansTotal, loansActive, loansReturned] = await Promise.all([
        Book.countDocuments({}),
        Book.aggregate([{ $group: { _id: null, available: { $sum: '$available' } } }]),
        User.countDocuments({}),
        Loan.countDocuments({}),
        Loan.countDocuments({ status: 'borrowed' }),
        Loan.countDocuments({ status: 'returned' }),
      ]);
      const available = booksAgg.length ? booksAgg[0].available : 0;
      const borrowed = Math.max(booksTotal - available, 0);
      resolve(Service.successResponse({
        books: { total: booksTotal, available, borrowed },
        users: { total: usersTotal },
        loans: { total: loansTotal, active: loansActive, returned: loansReturned },
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  statsGET,
};
