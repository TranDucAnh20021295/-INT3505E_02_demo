const crypto = require('crypto');

// Helper to hash password (same as in AuthenticationService)
function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// Helper to generate JWT token (same as in AuthenticationService)
function generateToken(payload, secret = 'secret') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Helper to validate response structure
function validateSuccessResponse(response) {
  return response && response.payload && typeof response.code === 'number';
}

// Helper to validate error response structure
function validateErrorResponse(response) {
  return response && response.error && typeof response.code === 'number';
}

module.exports = {
  hashPassword,
  generateToken,
  validateSuccessResponse,
  validateErrorResponse,
};

