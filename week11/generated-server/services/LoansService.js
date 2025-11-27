const { connectMongo } = require('../db');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Book = require('../models/Book');
const logger = require('../logger');

async function getNextId() {
  const Counter = require('../models/Counter');
  const counter = await Counter.findByIdAndUpdate(
    'loan_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const loansGET = async (requestParams) => {
  await connectMongo();
  const { offset = 0, limit = 10, search = '', status = '', user_id, book_id, sort_by = 'id', sort_order = 'desc' } = requestParams;
  
  const query = {};
  
  if (search) {
    query.$or = [
      { borrow_date: { $regex: search, $options: 'i' } },
      { return_date: { $regex: search, $options: 'i' } },
      { status: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) {
    query.status = status;
  }
  
  if (user_id) {
    query.user_id = parseInt(user_id);
  }
  
  if (book_id) {
    query.book_id = parseInt(book_id);
  }
  
  const sortOptions = {};
  sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
  
  const total = await Loan.countDocuments(query);
  const loans = await Loan.find(query)
    .sort(sortOptions)
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .lean();
  
  const pages = Math.ceil(total / limit);
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;
  
  return {
    code: 200,
    payload: {
      data: loans,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total,
        pages,
        has_next: hasNext,
        has_prev: hasPrev,
        next_num: hasNext ? Math.floor(offset / limit) + 2 : null,
        prev_num: hasPrev ? Math.floor(offset / limit) : null
      }
    }
  };
};

const usersUserIdLoansGET = async (requestParams) => {
  await connectMongo();
  const { user_id, offset = 0, limit = 10, status = '' } = requestParams;
  
  // Check if user exists
  const user = await User.findOne({ id: parseInt(user_id) });
  if (!user) {
    return {
      code: 404,
      payload: { error: 'User not found' }
    };
  }
  
  const query = { user_id: parseInt(user_id) };
  
  if (status) {
    query.status = status;
  }
  
  const total = await Loan.countDocuments(query);
  const loans = await Loan.find(query)
    .sort({ id: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .lean();
  
  const pages = Math.ceil(total / limit);
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;
  
  return {
    code: 200,
    payload: {
      data: loans,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total,
        pages,
        has_next: hasNext,
        has_prev: hasPrev,
        next_num: hasNext ? Math.floor(offset / limit) + 2 : null,
        prev_num: hasPrev ? Math.floor(offset / limit) : null
      }
    }
  };
};

const booksBookIdLoansGET = async (requestParams) => {
  await connectMongo();
  const { book_id, offset = 0, limit = 10, status = '' } = requestParams;
  
  // Check if book exists
  const Book = require('../models/Book');
  const book = await Book.findOne({ id: parseInt(book_id) });
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  const query = { book_id: parseInt(book_id) };
  
  if (status) {
    query.status = status;
  }
  
  const total = await Loan.countDocuments(query);
  const loans = await Loan.find(query)
    .sort({ id: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .lean();
  
  const pages = Math.ceil(total / limit);
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;
  
  return {
    code: 200,
    payload: {
      data: loans,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total,
        pages,
        has_next: hasNext,
        has_prev: hasPrev,
        next_num: hasNext ? Math.floor(offset / limit) + 2 : null,
        prev_num: hasPrev ? Math.floor(offset / limit) : null
      }
    }
  };
};

const loansLoanIdGET = async (requestParams) => {
  await connectMongo();
  const { loan_id } = requestParams;
  
  const loan = await Loan.findOne({ id: parseInt(loan_id) }).lean();
  
  if (!loan) {
    return {
      code: 404,
      payload: { error: 'Loan not found' }
    };
  }
  
  return {
    code: 200,
    payload: loan
  };
};

const loansPOST = async (requestParams) => {
  await connectMongo();
  const { body } = requestParams;
  const { user_id, book_id, borrow_date, return_date } = body;
  
  const User = require('../models/User');
  const Book = require('../models/Book');
  
  const user = await User.findOne({ id: user_id });
  if (!user) {
    return {
      code: 404,
      payload: { error: 'User not found' }
    };
  }
  
  const book = await Book.findOne({ id: book_id });
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  if (book.available <= 0) {
    return {
      code: 409,
      payload: { error: 'Book not available' }
    };
  }
  
  const existingLoan = await Loan.findOne({
    user_id,
    book_id,
    status: 'borrowed'
  });
  
  if (existingLoan) {
    return {
      code: 409,
      payload: { error: 'User already borrowed this book' }
    };
  }
  
  const loanId = await getNextId();
  const newLoan = new Loan({
    id: loanId,
    user_id,
    book_id,
    borrow_date,
    return_date,
    status: 'borrowed'
  });
  
  await newLoan.save();
  book.available -= 1;
  await book.save();
  
  return {
    code: 201,
    payload: {
      message: 'Loan created successfully',
      loan: newLoan.toObject()
    }
  };
};

const loansLoanIdReturnPUT = async (requestParams) => {
  await connectMongo();
  const { loan_id, body } = requestParams;
  const { actual_return_date } = body;
  
  const loan = await Loan.findOne({ id: parseInt(loan_id) });
  if (!loan) {
    return {
      code: 404,
      payload: { error: 'Loan not found' }
    };
  }
  
  if (loan.status !== 'borrowed') {
    return {
      code: 400,
      payload: { error: 'Loan not active' }
    };
  }
  
  const Book = require('../models/Book');
  const book = await Book.findOne({ id: loan.book_id });
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  loan.status = 'returned';
  loan.actual_return_date = actual_return_date;
  await loan.save();
  
  book.available += 1;
  await book.save();
  
  return {
    code: 200,
    payload: {
      message: 'Loan returned successfully',
      loan: loan.toObject()
    }
  };
};

const borrowsGET = async (requestParams) => {
  return loansGET(requestParams);
};

module.exports = {
  borrowsGET,
  loansGET,
  loansLoanIdGET,
  loansLoanIdReturnPUT,
  loansPOST,
  usersUserIdLoansGET,
  booksBookIdLoansGET,
};



