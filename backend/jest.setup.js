process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY =
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || require('crypto').randomBytes(32).toString('base64');
