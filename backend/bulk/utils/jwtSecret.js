// Single JWT secret for the whole app (both former "Metabsp" and "Bulk-invite" auth
// paths now issue/verify tokens through this). ACCESS_TOKEN_SECRET is read only as a
// migration alias so tokens issued before this merge don't all invalidate on deploy —
// set JWT_SECRET and retire ACCESS_TOKEN_SECRET once old tokens have expired.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET (or legacy ACCESS_TOKEN_SECRET) must be set in environment variables.');
  }
  return secret;
}

module.exports = { getJwtSecret };
