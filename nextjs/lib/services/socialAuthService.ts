// Ported from backend/src/services/socialAuthService.js.

// Google / Facebook sign-in.
//
// Two rules drive everything here:
//
// 1. NEVER trust a profile sent by the browser. The client hands us only an
//    opaque credential; the profile is fetched from the provider server-side.
//    Otherwise anyone could POST {email: "admin@..."} and be signed in as them.
//
// 2. NEVER link a social identity to an existing account by an unverified
//    email. If we did, someone who can register `victim@example.com` at a
//    provider that does not verify addresses would inherit that account here.
//    Linking by email therefore requires the provider to assert verification;
//    matching by provider ID is always safe because it is issued by them.
//
// Audience checks matter as much as signature checks: a Google ID token is
// signed by Google for *some* app. Without comparing `aud` to our own client
// ID, a token minted for an unrelated app would be accepted.

import axios from 'axios';
import AppError from '@/lib/utils/AppError';
import logger from '@/lib/utils/logger';

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const FB_GRAPH = 'https://graph.facebook.com';
const TIMEOUT_MS = 10000;

export const getGoogleClientId = () => String(process.env.GOOGLE_CLIENT_ID || '').trim();

// Facebook Login reuses the same Meta app as WhatsApp Embedded Signup, so the
// existing META_APP_ID/META_APP_SECRET are the default. FACEBOOK_APP_ID /
// FACEBOOK_APP_SECRET override them if you ever split the two apps.
export const getFacebookAppId = () =>
  String(process.env.FACEBOOK_APP_ID || process.env.META_APP_ID || '').trim();
const getFacebookAppSecret = () =>
  String(process.env.FACEBOOK_APP_SECRET || process.env.META_APP_SECRET || '').trim();

export const isGoogleEnabled = () => Boolean(getGoogleClientId());
export const isFacebookEnabled = () => Boolean(getFacebookAppId() && getFacebookAppSecret());

// `public_profile` is granted to every Meta app by default. `email` is NOT:
// it has to be enabled through a Facebook Login use case, which an app set up
// for WhatsApp Business Messaging does not get automatically. Requesting it
// anyway makes the login dialog fail outright with
// "Invalid Scopes: email" / "This content isn't available at the moment",
// so the default asks only for what is always available.
//
// Once the app has the email permission (Meta App Dashboard → Use cases →
// Authentication and account creation), set
// FACEBOOK_LOGIN_SCOPES=public_profile,email to turn it on. That is worth
// doing: without an email address, Facebook sign-in can never link to an
// existing account and will always create a new one.
const DEFAULT_FACEBOOK_SCOPES = 'public_profile';

export const getFacebookLoginScopes = () =>
  String(process.env.FACEBOOK_LOGIN_SCOPES || DEFAULT_FACEBOOK_SCOPES)
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(',') || DEFAULT_FACEBOOK_SCOPES;

/**
 * Verifies a Google ID token and returns a normalised profile.
 *
 * `tokeninfo` performs signature, expiry and issuer validation for us. The one
 * check it cannot do is audience — that is ours to make, below.
 */
export const verifyGoogleIdToken = async (idToken) => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new AppError('Google sign-in is not configured on this server', 503);
  if (!idToken) throw new AppError('A Google credential is required', 400);

  let data;
  try {
    const res = await axios.get(GOOGLE_TOKENINFO_URL, {
      params: { id_token: idToken },
      timeout: TIMEOUT_MS,
    });
    data = res.data || {};
  } catch (error) {
    logger.warn('[social-auth] Google token verification failed:', error?.response?.data?.error_description || error.message);
    throw new AppError('Google sign-in could not be verified', 401);
  }

  // The token is validly signed, but possibly for a different application.
  if (String(data.aud || '') !== clientId) {
    logger.warn('[social-auth] Google token audience mismatch');
    throw new AppError('Google sign-in could not be verified', 401);
  }
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(String(data.iss || ''))) {
    throw new AppError('Google sign-in could not be verified', 401);
  }
  if (!data.sub) throw new AppError('Google did not return a user identifier', 502);

  return {
    provider: 'google',
    providerId: String(data.sub),
    email: String(data.email || '').toLowerCase(),
    // tokeninfo returns this as the string 'true'/'false', not a boolean.
    emailVerified: String(data.email_verified) === 'true',
    name: String(data.name || '').trim(),
  };
};

/**
 * Verifies a Facebook user access token and returns a normalised profile.
 *
 * debug_token is the audience check: it reports which app the token was
 * issued for, so a token minted for someone else's app is rejected.
 */
export const verifyFacebookAccessToken = async (accessToken) => {
  const appId = getFacebookAppId();
  const appSecret = getFacebookAppSecret();
  if (!appId || !appSecret) throw new AppError('Facebook sign-in is not configured on this server', 503);
  if (!accessToken) throw new AppError('A Facebook access token is required', 400);

  let debug;
  try {
    const res = await axios.get(`${FB_GRAPH}/debug_token`, {
      params: { input_token: accessToken, access_token: `${appId}|${appSecret}` },
      timeout: TIMEOUT_MS,
    });
    debug = res.data?.data || {};
  } catch (error) {
    logger.warn('[social-auth] Facebook token debug failed:', error?.response?.data?.error?.message || error.message);
    throw new AppError('Facebook sign-in could not be verified', 401);
  }

  if (!debug.is_valid) throw new AppError('Facebook sign-in could not be verified', 401);
  if (String(debug.app_id || '') !== appId) {
    logger.warn('[social-auth] Facebook token app_id mismatch');
    throw new AppError('Facebook sign-in could not be verified', 401);
  }
  if (!debug.user_id) throw new AppError('Facebook did not return a user identifier', 502);

  // Requesting a field the granted token does not cover makes Graph error
  // rather than omit it, so the field list follows the configured scopes.
  const fields = getFacebookLoginScopes().includes('email') ? 'id,name,email' : 'id,name';

  // Annotated because TypeScript infers `{}` from the initialiser and then
  // rejects the property reads below; the shape is whatever Graph returns.
  let profile: any = {};
  try {
    const res = await axios.get(`${FB_GRAPH}/me`, {
      params: { fields },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: TIMEOUT_MS,
    });
    profile = res.data || {};
  } catch (error) {
    logger.warn('[social-auth] Facebook profile fetch failed:', error?.response?.data?.error?.message || error.message);
  }

  return {
    provider: 'facebook',
    providerId: String(debug.user_id),
    email: String(profile.email || '').toLowerCase(),
    // Facebook only ever returns an address it considers confirmed, and omits
    // the field otherwise — so presence is the verification signal. Treated
    // conservatively: absent email simply means "cannot link by email".
    emailVerified: Boolean(profile.email),
    name: String(profile.name || '').trim(),
  };
};

const PROVIDER_FIELD = { google: 'googleId', facebook: 'facebookId' };

/**
 * Turns a verified provider profile into a local user.
 *
 * Resolution order, most trustworthy first:
 *   1. Existing account already carrying this provider ID  → sign in.
 *   2. Existing account with the same VERIFIED email       → link, then sign in.
 *   3. No match                                            → create.
 *
 * An existing account matched on an UNVERIFIED email is deliberately refused
 * rather than linked or duplicated: silently creating a second account would
 * be confusing, and linking would be an account takeover.
 */
export const resolveUserForSocialProfile = async ({ profile, User, getGlobalRoles }) => {
  const field = PROVIDER_FIELD[profile.provider];
  if (!field) throw new AppError('Unsupported sign-in provider', 400);

  const existingByProvider = await User.findOne({ [field]: profile.providerId }).populate('roleId');
  if (existingByProvider) {
    if (!existingByProvider.isActive) throw new AppError('Account is inactive', 403);
    return { user: existingByProvider, outcome: 'signed_in' };
  }

  if (profile.email) {
    const existingByEmail = await User.findOne({ email: profile.email, tenantId: null }).populate('roleId');
    if (existingByEmail) {
      if (!profile.emailVerified) {
        throw new AppError(
          'An account already uses this email address. Sign in with your password first, then link this provider from your account settings.',
          409
        );
      }
      if (!existingByEmail.isActive) throw new AppError('Account is inactive', 403);
      existingByEmail[field] = profile.providerId;
      if (!existingByEmail.emailVerified) existingByEmail.emailVerified = true;
      await existingByEmail.save();
      return { user: existingByEmail, outcome: 'linked' };
    }
  }

  const { userRole } = await getGlobalRoles();
  const username = await generateUniqueUsername({ profile, User });

  const user = await User.create({
    name: profile.name || username,
    username,
    // No password field at all — the schema requires one only when neither
    // provider ID is set.
    email: profile.email || '',
    emailVerified: Boolean(profile.email && profile.emailVerified),
    [field]: profile.providerId,
    roleId: userRole._id,
    tenantId: null,
    isActive: true,
  });

  return { user: await user.populate('roleId'), outcome: 'created' };
};

// Usernames are unique per tenant and surfaced in the UI, so derive something
// readable from the email local part or display name, then disambiguate.
export const generateUniqueUsername = async ({ profile, User }) => {
  const base =
    String(profile.email || '').split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') ||
    String(profile.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') ||
    profile.provider;

  const seed = base.slice(0, 24) || profile.provider;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? seed : `${seed}${attempt + 1}`;
    const taken = await User.findOne({ username: candidate, tenantId: null }).lean();
    if (!taken) return candidate;
  }

  // Deterministic collision escape rather than an unbounded loop.
  return `${seed}-${profile.providerId.slice(-6)}`;
};


