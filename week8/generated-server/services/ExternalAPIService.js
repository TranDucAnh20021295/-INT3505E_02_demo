/* eslint-disable no-unused-vars */
const Service = require('./Service');

const tokenCache = new Map();

const external_apiApiNameGET = ({ apiUnderscorename }) => new Promise(
  async (resolve, reject) => {
    try {
      const name = String(apiUnderscorename);
      const now = new Date();
      let token = tokenCache.get(name);
      if (!token || (now - token.createdAt) > 60 * 60 * 1000) { // 1h
        token = { value: `external_token_${name}_${Math.floor(now.getTime()/1000)}`, createdAt: now };
        tokenCache.set(name, token);
      }
      resolve(Service.successResponse({
        message: `Called external API ${name}`,
        data: {
          api_name: name,
          token_used: token.value,
          timestamp: now.toISOString(),
          user_id: 1,
        }
      }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 405));
    }
  },
);

module.exports = {
  external_apiApiNameGET,
};
