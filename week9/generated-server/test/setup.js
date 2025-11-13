const mongoose = require('mongoose');
const { connectMongo } = require('../db');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Counter = require('../models/Counter');

// Use test database
const TEST_DB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/library_v8_test';

let connection;

async function setupTestDB() {
  try {
    // Connect to test database
    await mongoose.connect(TEST_DB_URI, { dbName: 'library_v8_test' });
    connection = mongoose.connection;
    console.log('Test database connected');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
}

async function cleanupTestDB() {
  try {
    // Clear all collections
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Counter.deleteMany({});
    console.log('Test database cleaned');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    throw error;
  }
}

async function closeTestDB() {
  try {
    if (connection) {
      await mongoose.connection.close();
      console.log('Test database connection closed');
    }
  } catch (error) {
    console.error('Failed to close test database:', error);
    throw error;
  }
}

// Helper function to create test user
async function createTestUser(userData = {}) {
  const defaultUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    ...userData
  };
  return await User.create(defaultUser);
}

// Helper function to create test book
async function createTestBook(bookData = {}) {
  const defaultBook = {
    id: 1,
    title: 'Test Book',
    author: 'Test Author',
    available: 1,
    updated_at: new Date(),
    ...bookData
  };
  return await Book.create(defaultBook);
}

// Helper function to create test loan
async function createTestLoan(loanData = {}) {
  const defaultLoan = {
    id: 1,
    user_id: 1,
    book_id: 1,
    borrow_date: '2024-01-01',
    return_date: '2024-01-15',
    status: 'borrowed',
    actual_return_date: null,
    ...loanData
  };
  return await Loan.create(defaultLoan);
}

module.exports = {
  setupTestDB,
  cleanupTestDB,
  closeTestDB,
  createTestUser,
  createTestBook,
  createTestLoan,
};

