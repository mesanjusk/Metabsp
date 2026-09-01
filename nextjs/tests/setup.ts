import { vi } from 'vitest';
import crypto from 'crypto';

// Next's generated types declare NODE_ENV read-only; assigning through the
// record shape is the supported way to set it for a test process.
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY =
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64');

// Nothing under test should reach a real Redis or Mongo. Both are stubbed at
// the module boundary the app already funnels every access through, so a test
// that accidentally opens a connection fails loudly here rather than hanging
// against a socket that is not listening.
vi.mock('@/lib/db/redis', () => ({
  getRedisConnection: () => {
    throw new Error('getRedisConnection was called without being mocked for this test');
  },
}));

vi.mock('@/lib/db/mongo', () => ({
  connectDB: vi.fn(async () => undefined),
}));
