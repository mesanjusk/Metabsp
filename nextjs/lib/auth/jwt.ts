import jwt from 'jsonwebtoken';

// Ported from backend/bulk/utils/jwtSecret.js — MUST resolve to the same
// secret the always-on host uses (same JWT_SECRET/ACCESS_TOKEN_SECRET env
// values), since tokens issued by either app must verify on both.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET (or legacy ACCESS_TOKEN_SECRET) must be set in environment variables.');
  }
  return secret;
}

/**
 * Session lifetime.
 *
 * The original hardcoded 99 days, while the deployment configuration set
 * JWT_EXPIRES_IN=7d — so the variable operators were setting had no effect and
 * every session token stayed valid for over three months. That is a long time
 * for a bearer token held in browser storage: revoking access meant
 * deactivating the account, because the token itself could not be expired.
 *
 * The env var is now honoured, with a 7-day default matching what the
 * deployment already declared.
 */
const DEFAULT_TOKEN_TTL = '7d';

export function signTokenForUser(userId: unknown): string {
  return jwt.sign({ id: userId, type: 'db-user' }, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || DEFAULT_TOKEN_TTL) as any,
  });
}

export function verifyToken(token: string): { id: string; type: string } {
  return jwt.verify(token, getJwtSecret()) as { id: string; type: string };
}
