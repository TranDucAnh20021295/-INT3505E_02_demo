/* eslint-disable no-unused-vars */
const Service = require('./Service');
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
async function getNextSequence(name) {
  const result = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return result.seq;
}

const loginPOST = ({ userLogin }) => new Promise(
  async (resolve, reject) => {
    try {
      const { email, password } = userLogin || {};
      if (!email || !password) return reject(Service.rejectResponse('Missing email or password', 400));
      const u = await User.findOne({ email }).lean();
      if (!u) return reject(Service.rejectResponse('Invalid credentials', 401));
      const salt = String(u.id);
      const expected = hashPassword(password, salt);
      if (expected !== u.password_hash) return reject(Service.rejectResponse('Invalid credentials', 401));
      const token = generateToken({ sub: u.id, email: u.email, iat: Date.now() }, process.env.JWT_SECRET || 'secret');
      resolve(Service.successResponse({
        message: 'Login successful',
        token,
        user: { id: u.id, name: u.name, email: u.email },
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

const registerPOST = ({ userRegister }) => new Promise(
  async (resolve, reject) => {
    try {
      const { name, email, password } = userRegister || {};
      if (!name || !email || !password) return reject(Service.rejectResponse('Missing fields', 400));
      const exists = await User.findOne({ email }).lean();
      if (exists) return reject(Service.rejectResponse('User already exists', 409));
      const id = await getNextSequence('users');
      const salt = String(id);
      const password_hash = hashPassword(password, salt);
      await User.create({ id, name, email, password_hash });
      resolve(Service.successResponse({ message: 'User registered successfully' }, 201));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  loginPOST,
  registerPOST,
};
