const { connectMongo } = require('../db');
const User = require('../models/User');
const Counter = require('../models/Counter');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function generateToken(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function getNextId() {
  const counter = await Counter.findByIdAndUpdate(
    'user_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const loginPOST = async (requestParams) => {
  await connectMongo();
  const { body, userLogin } = requestParams;
  const data = userLogin || body || {};
  const { email, password } = data;
  
  if (!email || !password) {
    return {
      code: 400,
      payload: { error: 'Missing email or password' }
    };
  }
  
  const user = await User.findOne({ email }).lean();
  if (!user) {
    return {
      code: 401,
      payload: { error: 'Invalid credentials' }
    };
  }
  
  const salt = String(user.id);
  const expected = hashPassword(password, salt);
  if (expected !== user.password_hash) {
    return {
      code: 401,
      payload: { error: 'Invalid credentials' }
    };
  }
  
  const token = generateToken(
    { sub: user.id, email: user.email, iat: Date.now() },
    process.env.JWT_SECRET || 'secret'
  );
  
  return {
    code: 200,
    payload: {
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    }
  };
};

const registerPOST = async (requestParams) => {
  await connectMongo();
  const { body, userRegister } = requestParams;
  const data = userRegister || body || {};
  const { name, email, password } = data;
  
  if (!name || !email || !password) {
    return {
      code: 400,
      payload: { error: 'Missing fields: name, email, and password are required' }
    };
  }
  
  const exists = await User.findOne({ email });
  if (exists) {
    return {
      code: 409,
      payload: { error: 'User already exists' }
    };
  }
  
  const id = await getNextId();
  const salt = String(id);
  const password_hash = hashPassword(password, salt);
  
  await User.create({ id, name, email, password_hash });
  
  return {
    code: 201,
    payload: { message: 'User registered successfully' }
  };
};

module.exports = {
  loginPOST,
  registerPOST,
};



