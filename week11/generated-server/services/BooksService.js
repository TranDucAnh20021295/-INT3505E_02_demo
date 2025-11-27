const { connectMongo } = require('../db');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const logger = require('../logger');

async function getNextId() {
  const Counter = require('../models/Counter');
  const counter = await Counter.findByIdAndUpdate(
    'book_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const booksGET = async (requestParams) => {
  await connectMongo();
  const { offset = 0, limit = 10, search = '', sort_by = 'id', sort_order = 'asc' } = requestParams;
  
  const query = {};
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } }
    ];
  }
  
  const sortOptions = {};
  sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
  
  const total = await Book.countDocuments(query);
  const books = await Book.find(query)
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
      data: books,
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

const booksIdGET = async (requestParams) => {
  await connectMongo();
  const { id } = requestParams;
  
  const book = await Book.findOne({ id: parseInt(id) }).lean();
  
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  return {
    code: 200,
    payload: book
  };
};

const booksPOST = async (requestParams) => {
  await connectMongo();
  const { body } = requestParams;
  const { title, author } = body;
  
  const bookId = await getNextId();
  const newBook = new Book({
    id: bookId,
    title,
    author,
    available: 1,
    updated_at: new Date()
  });
  
  await newBook.save();
  
  return {
    code: 201,
    payload: {
      message: 'Book created successfully',
      book: newBook.toObject()
    }
  };
};

const booksIdPUT = async (requestParams) => {
  await connectMongo();
  const { id, body } = requestParams;
  const { title, author } = body;
  
  const book = await Book.findOne({ id: parseInt(id) });
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  if (title) book.title = title;
  if (author) book.author = author;
  book.updated_at = new Date();
  
  await book.save();
  
  return {
    code: 200,
    payload: {
      message: 'Book updated',
      book: book.toObject()
    }
  };
};

const booksIdDELETE = async (requestParams) => {
  await connectMongo();
  const { id } = requestParams;
  
  const book = await Book.findOneAndDelete({ id: parseInt(id) });
  
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  return {
    code: 200,
    payload: {
      message: 'Book deleted',
      book: book.toObject()
    }
  };
};

const booksBookIdAvailableGET = async (requestParams) => {
  await connectMongo();
  const { book_id } = requestParams;
  
  const book = await Book.findOne({ id: parseInt(book_id) }).lean();
  
  if (!book) {
    return {
      code: 404,
      payload: { error: 'Book not found' }
    };
  }
  
  return {
    code: 200,
    payload: {
      book_id: parseInt(book_id),
      available: book.available,
      is_available: book.available > 0
    }
  };
};

module.exports = {
  booksGET,
  booksIdGET,
  booksPOST,
  booksIdPUT,
  booksIdDELETE,
  booksBookIdAvailableGET,
};



