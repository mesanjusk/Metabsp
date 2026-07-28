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

// Ported from backend/src/routes/Users.js:signTokenForUser.
export function signTokenForUser(userId: unknown): string {
  return jwt.sign({ id: userId, type: 'db-user' }, getJwtSecret(), { expiresIn: '99d' });
}

export function verifyToken(token: string): { id: string; type: string } {
  return jwt.verify(token, getJwtSecret()) as { id: string; type: string };
}
