const tokenCache = new Map();

const external_apiApiNameGET = async (requestParams) => {
  const { api_name } = requestParams;
  const name = String(api_name);
  const now = new Date();
  
  let token = tokenCache.get(name);
  if (!token || (now - token.createdAt) > 60 * 60 * 1000) { // 1 hour
    token = {
      value: `external_token_${name}_${Math.floor(now.getTime() / 1000)}`,
      createdAt: now
    };
    tokenCache.set(name, token);
  }
  
  return {
    code: 200,
    payload: {
      message: `Called external API ${name}`,
      data: {
        api_name: name,
        token_used: token.value,
        timestamp: now.toISOString(),
        user_id: 1
      }
    }
  };
};

module.exports = {
  external_apiApiNameGET,
};



