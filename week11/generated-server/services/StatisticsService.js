const { connectMongo } = require('../db');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');

const statsGET = async (requestParams) => {
  await connectMongo();
  
  const [booksTotal, booksAgg, usersTotal, loansTotal, loansActive, loansReturned] = await Promise.all([
    Book.countDocuments({}),
    Book.aggregate([{ $group: { _id: null, available: { $sum: '$available' } } }]),
    User.countDocuments({}),
    Loan.countDocuments({}),
    Loan.countDocuments({ status: 'borrowed' }),
    Loan.countDocuments({ status: 'returned' })
  ]);
  
  const available = booksAgg.length ? booksAgg[0].available : 0;
  const borrowed = Math.max(booksTotal - available, 0);
  
  return {
    code: 200,
    payload: {
      books: { total: booksTotal, available, borrowed },
      users: { total: usersTotal },
      loans: { total: loansTotal, active: loansActive, returned: loansReturned }
    }
  };
};

module.exports = {
  statsGET,
};



