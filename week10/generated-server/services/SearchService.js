const { connectMongo } = require('../db');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');
const logger = require('../logger');

const searchGET = async (requestParams) => {
  await connectMongo();
  const { q, type = 'all', page = 1, per_page = 10 } = requestParams;
  
  if (!q) {
    return {
      code: 400,
      payload: { error: 'Search query is required' }
    };
  }
  
  const results = [];
  const searchRegex = { $regex: q, $options: 'i' };
  
  if (type === 'all' || type === 'books') {
    const books = await Book.find({
      $or: [
        { title: searchRegex },
        { author: searchRegex }
      ]
    }).limit(per_page).lean();
    
    books.forEach(book => {
      results.push({
        type: 'book',
        id: book.id,
        title: book.title,
        author: book.author,
        available: book.available
      });
    });
  }
  
  if (type === 'all' || type === 'users') {
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    }).limit(per_page).lean();
    
    users.forEach(user => {
      results.push({
        type: 'user',
        id: user.id,
        name: user.name,
        email: user.email
      });
    });
  }
  
  if (type === 'all' || type === 'loans') {
    const loans = await Loan.find({
      $or: [
        { borrow_date: searchRegex },
        { return_date: searchRegex },
        { status: searchRegex }
      ]
    }).limit(per_page).lean();
    
    loans.forEach(loan => {
      results.push({
        type: 'loan',
        id: loan.id,
        user_id: loan.user_id,
        book_id: loan.book_id,
        borrow_date: loan.borrow_date,
        status: loan.status
      });
    });
  }
  
  return {
    code: 200,
    payload: {
      query: q,
      entity_type: type,
      results: results.slice(0, per_page)
    }
  };
};

const searchTypeQueryGET = async (requestParams) => {
  await connectMongo();
  const { type, query, page = 1, per_page = 10 } = requestParams;
  
  if (!query) {
    return {
      code: 400,
      payload: { error: 'Search query is required' }
    };
  }
  
  const results = [];
  const searchRegex = { $regex: query, $options: 'i' };
  
  if (type === 'all' || type === 'books') {
    const books = await Book.find({
      $or: [
        { title: searchRegex },
        { author: searchRegex }
      ]
    }).limit(per_page).lean();
    
    books.forEach(book => {
      results.push({
        type: 'book',
        id: book.id,
        title: book.title,
        author: book.author,
        available: book.available
      });
    });
  }
  
  if (type === 'all' || type === 'users') {
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    }).limit(per_page).lean();
    
    users.forEach(user => {
      results.push({
        type: 'user',
        id: user.id,
        name: user.name,
        email: user.email
      });
    });
  }
  
  if (type === 'all' || type === 'loans') {
    const loans = await Loan.find({
      $or: [
        { borrow_date: searchRegex },
        { return_date: searchRegex },
        { status: searchRegex }
      ]
    }).limit(per_page).lean();
    
    loans.forEach(loan => {
      results.push({
        type: 'loan',
        id: loan.id,
        user_id: loan.user_id,
        book_id: loan.book_id,
        borrow_date: loan.borrow_date,
        status: loan.status
      });
    });
  }
  
  return {
    code: 200,
    payload: {
      query: query,
      entity_type: type,
      results: results.slice(0, per_page)
    }
  };
};

module.exports = {
  searchGET,
  searchTypeQueryGET,
};



