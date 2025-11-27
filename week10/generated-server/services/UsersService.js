const { connectMongo } = require('../db');
const User = require('../models/User');
const logger = require('../logger');

async function getNextId() {
  const Counter = require('../models/Counter');
  const counter = await Counter.findByIdAndUpdate(
    'user_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const usersGET = async (requestParams) => {
  await connectMongo();
  const { offset = 0, limit = 10, search = '', sort_by = 'id', sort_order = 'asc' } = requestParams;
  
  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  const sortOptions = {};
  sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
  
  const total = await User.countDocuments(query);
  const users = await User.find(query)
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
      data: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
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

const usersUserIdGET = async (requestParams) => {
  await connectMongo();
  const { user_id } = requestParams;
  
  const user = await User.findOne({ id: parseInt(user_id) }).lean();
  
  if (!user) {
    return {
      code: 404,
      payload: { error: 'User not found' }
    };
  }
  
  return {
    code: 200,
    payload: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  };
};

module.exports = {
  usersGET,
  usersUserIdGET,
};



