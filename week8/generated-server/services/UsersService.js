/* eslint-disable no-unused-vars */
const Service = require('./Service');
const User = require('../models/User');

function toInt(x, d = 0) { const v = parseInt(x, 10); return Number.isNaN(v) ? d : v; }

const usersGET = ({ offset, limit }) => new Promise(
  async (resolve, reject) => {
    try {
      offset = toInt(offset, 0);
      limit = Math.min(Math.max(toInt(limit, 10), 1), 100);
      const filter = {};
      const sort = { id: 1 };
      const total = await User.countDocuments(filter);
      const items = await User.find(filter).sort(sort).skip(offset).limit(limit).lean();
      resolve(Service.successResponse({
        data: items.map(u => ({ id: u.id, name: u.name, email: u.email })),
        pagination: {
          offset,
          limit,
          total,
          pages: Math.ceil(total / limit),
          has_next: offset + limit < total,
          has_prev: offset > 0,
          next_num: offset + limit < total ? Math.floor(offset / limit) + 2 : null,
          prev_num: offset > 0 ? Math.floor((offset - 1) / limit) + 1 : null,
        },
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  usersGET,
};
