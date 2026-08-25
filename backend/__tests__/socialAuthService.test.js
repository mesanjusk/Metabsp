// Provider calls are mocked throughout — no request reaches Google or Facebook.
// The assertions here are mostly about what must be REFUSED: a token minted for
// another app, and linking to an existing account on an unverified email.
jest.mock('axios');

const axios = require('axios');
const {
  isGoogleEnabled,
  isFacebookEnabled,
  getFacebookLoginScopes,
  verifyGoogleIdToken,
  verifyFacebookAccessToken,
  resolveUserForSocialProfile,
  generateUniqueUsername,
} = require('../src/services/socialAuthService');

const ENV = ['GOOGLE_CLIENT_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'META_APP_ID', 'META_APP_SECRET', 'FACEBOOK_LOGIN_SCOPES'];
const original = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of ENV) original[k] = process.env[k];
  process.env.GOOGLE_CLIENT_ID = 'google-client-id.apps.googleusercontent.com';
  process.env.META_APP_ID = '1717826239505344';
  process.env.META_APP_SECRET = 'app-secret';
  delete process.env.FACEBOOK_APP_ID;
  delete process.env.FACEBOOK_APP_SECRET;
  delete process.env.FACEBOOK_LOGIN_SCOPES;
  delete process.env.FACEBOOK_LOGIN_SCOPES;
});

afterEach(() => {
  for (const k of ENV) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('provider enablement', () => {
  it('reports google enabled only when a client id is set', () => {
    expect(isGoogleEnabled()).toBe(true);
    delete process.env.GOOGLE_CLIENT_ID;
    expect(isGoogleEnabled()).toBe(false);
  });

  it('does NOT enable Facebook from the WhatsApp Meta app credentials alone', () => {
    // META_APP_ID/META_APP_SECRET are set in beforeEach and exist on every
    // deployment. Inheriting them showed a Facebook button on apps that had
    // never enabled Facebook Login, where the dialog fails with "This app
    // needs at least one supported permission". Opting in must be explicit.
    expect(process.env.META_APP_ID).toBeTruthy();
    expect(process.env.META_APP_SECRET).toBeTruthy();
    expect(isFacebookEnabled()).toBe(false);
  });

  it('enables Facebook only when both explicit credentials are set', () => {
    process.env.FACEBOOK_APP_ID = '1717826239505344';
    expect(isFacebookEnabled()).toBe(false);
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
    expect(isFacebookEnabled()).toBe(true);
  });
});

describe('verifyGoogleIdToken', () => {
  const googlePayload = (over = {}) => ({
    data: {
      aud: 'google-client-id.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
      sub: '1122334455',
      email: 'Asha@Example.com',
      email_verified: 'true',
      name: 'Asha R',
      ...over,
    },
  });

  it('returns a normalised profile for a valid token', async () => {
    axios.get.mockResolvedValue(googlePayload());
    const profile = await verifyGoogleIdToken('tok');
    expect(profile).toEqual({
      provider: 'google',
      providerId: '1122334455',
      email: 'asha@example.com',
      emailVerified: true,
      name: 'Asha R',
    });
  });

  it('rejects a token minted for a different application', async () => {
    // Correctly signed by Google, but for someone else's app.
    axios.get.mockResolvedValue(googlePayload({ aud: 'someone-elses-app.apps.googleusercontent.com' }));
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/could not be verified/);
  });

  it('rejects a token from an unexpected issuer', async () => {
    axios.get.mockResolvedValue(googlePayload({ iss: 'https://evil.example.com' }));
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/could not be verified/);
  });

  it('treats email_verified as the string Google actually sends', async () => {
    axios.get.mockResolvedValue(googlePayload({ email_verified: 'false' }));
    expect((await verifyGoogleIdToken('tok')).emailVerified).toBe(false);
  });

  it('rejects when Google rejects the token', async () => {
    axios.get.mockRejectedValue({ response: { data: { error_description: 'Invalid Value' } } });
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/could not be verified/);
  });

  it('refuses to run at all when unconfigured, without calling out', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(verifyGoogleIdToken('tok')).rejects.toThrow(/not configured/);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('getFacebookLoginScopes', () => {
  it('defaults to public_profile only', () => {
    // `email` is not granted to a WhatsApp-Business-Messaging app by default,
    // and requesting an unavailable scope fails the entire login dialog with
    // "Invalid Scopes: email" — so it must never be the default.
    expect(getFacebookLoginScopes()).toBe('public_profile');
  });

  it('honours an explicit opt-in once the app has the permission', () => {
    process.env.FACEBOOK_LOGIN_SCOPES = 'public_profile, email';
    expect(getFacebookLoginScopes()).toBe('public_profile,email');
  });

  it('falls back to the default rather than sending an empty scope', () => {
    process.env.FACEBOOK_LOGIN_SCOPES = '  ,  ';
    expect(getFacebookLoginScopes()).toBe('public_profile');
  });
});

describe('verifyFacebookAccessToken', () => {
  const debugOk = { data: { data: { is_valid: true, app_id: '1717826239505344', user_id: '99887766' } } };

  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = '1717826239505344';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });

  it('refuses to call out when Facebook sign-in is not configured', async () => {
    delete process.env.FACEBOOK_APP_ID;
    await expect(verifyFacebookAccessToken('tok')).rejects.toThrow(/not configured/);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('does not ask Graph for email unless the scope was requested', async () => {
    // Requesting a field the token does not cover makes Graph error outright.
    axios.get.mockResolvedValueOnce(debugOk).mockResolvedValueOnce({ data: { id: '99887766', name: 'Ravi K' } });
    await verifyFacebookAccessToken('tok');
    expect(axios.get.mock.calls[1][1].params.fields).toBe('id,name');
  });

  it('asks Graph for email once the scope is enabled', async () => {
    process.env.FACEBOOK_LOGIN_SCOPES = 'public_profile,email';
    axios.get.mockResolvedValueOnce(debugOk).mockResolvedValueOnce({ data: { id: '99887766', name: 'Ravi K', email: 'r@e.com' } });
    await verifyFacebookAccessToken('tok');
    expect(axios.get.mock.calls[1][1].params.fields).toBe('id,name,email');
  });

  it('returns a normalised profile for a valid token', async () => {
    process.env.FACEBOOK_LOGIN_SCOPES = 'public_profile,email';
    axios.get
      .mockResolvedValueOnce(debugOk)
      .mockResolvedValueOnce({ data: { id: '99887766', name: 'Ravi K', email: 'Ravi@Example.com' } });

    expect(await verifyFacebookAccessToken('tok')).toEqual({
      provider: 'facebook',
      providerId: '99887766',
      email: 'ravi@example.com',
      emailVerified: true,
      name: 'Ravi K',
    });
  });

  it('rejects a token issued for a different app', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: { is_valid: true, app_id: '999999', user_id: '1' } } });
    await expect(verifyFacebookAccessToken('tok')).rejects.toThrow(/could not be verified/);
  });

  it('rejects an invalid token', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: { is_valid: false } } });
    await expect(verifyFacebookAccessToken('tok')).rejects.toThrow(/could not be verified/);
  });

  it('still signs in when Facebook withholds the email, but marks it unverified', async () => {
    axios.get.mockResolvedValueOnce(debugOk).mockResolvedValueOnce({ data: { id: '99887766', name: 'Ravi K' } });
    const profile = await verifyFacebookAccessToken('tok');
    expect(profile.email).toBe('');
    expect(profile.emailVerified).toBe(false);
  });
});

describe('resolveUserForSocialProfile', () => {
  const userRole = { _id: 'role-user' };
  const getGlobalRoles = jest.fn(async () => ({ userRole }));

  const makeUser = (over = {}) => ({
    _id: 'u1',
    isActive: true,
    emailVerified: false,
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue({ _id: 'u1', ...over }),
    ...over,
  });

  const makeUserModel = ({ byProvider = null, byEmail = null, byUsername = null } = {}) => ({
    findOne: jest.fn((query) => {
      const chain = (doc) => ({ populate: () => Promise.resolve(doc), lean: () => Promise.resolve(doc), then: undefined });
      if (query.googleId || query.facebookId) return chain(byProvider);
      if (query.email) return chain(byEmail);
      if (query.username) return chain(byUsername);
      return chain(null);
    }),
    create: jest.fn(async (doc) => ({ ...doc, _id: 'new-user', populate: async () => ({ ...doc, _id: 'new-user' }) })),
  });

  const googleProfile = (over = {}) => ({
    provider: 'google',
    providerId: '1122334455',
    email: 'asha@example.com',
    emailVerified: true,
    name: 'Asha R',
    ...over,
  });

  it('signs in an account already carrying the provider id', async () => {
    const existing = makeUser({ googleId: '1122334455' });
    const User = makeUserModel({ byProvider: existing });

    const { outcome, user } = await resolveUserForSocialProfile({ profile: googleProfile(), User, getGlobalRoles });

    expect(outcome).toBe('signed_in');
    expect(user).toBe(existing);
    expect(User.create).not.toHaveBeenCalled();
  });

  it('links to an existing account when the provider verified the email', async () => {
    const existing = makeUser({ email: 'asha@example.com' });
    const User = makeUserModel({ byEmail: existing });

    const { outcome } = await resolveUserForSocialProfile({ profile: googleProfile(), User, getGlobalRoles });

    expect(outcome).toBe('linked');
    expect(existing.googleId).toBe('1122334455');
    expect(existing.emailVerified).toBe(true);
    expect(existing.save).toHaveBeenCalled();
  });

  it('REFUSES to link on an unverified email — this would be account takeover', async () => {
    const existing = makeUser({ email: 'asha@example.com' });
    const User = makeUserModel({ byEmail: existing });

    await expect(
      resolveUserForSocialProfile({ profile: googleProfile({ emailVerified: false }), User, getGlobalRoles })
    ).rejects.toThrow(/Sign in with your password first/);

    expect(existing.save).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('creates a new account with no password field when nothing matches', async () => {
    const User = makeUserModel();

    const { outcome } = await resolveUserForSocialProfile({ profile: googleProfile(), User, getGlobalRoles });

    expect(outcome).toBe('created');
    const created = User.create.mock.calls[0][0];
    expect(created).not.toHaveProperty('password');
    expect(created.googleId).toBe('1122334455');
    expect(created.roleId).toBe('role-user');
    expect(created.tenantId).toBeNull();
  });

  it('does not mark a new account email-verified when the provider did not', async () => {
    const User = makeUserModel();
    await resolveUserForSocialProfile({ profile: googleProfile({ emailVerified: false }), User, getGlobalRoles });
    expect(User.create.mock.calls[0][0].emailVerified).toBe(false);
  });

  it('refuses an inactive account rather than signing it in', async () => {
    const User = makeUserModel({ byProvider: makeUser({ googleId: '1122334455', isActive: false }) });
    await expect(resolveUserForSocialProfile({ profile: googleProfile(), User, getGlobalRoles })).rejects.toThrow(/inactive/);
  });

  it('rejects an unsupported provider', async () => {
    const User = makeUserModel();
    await expect(
      resolveUserForSocialProfile({ profile: googleProfile({ provider: 'twitter' }), User, getGlobalRoles })
    ).rejects.toThrow(/Unsupported/);
  });
});

describe('generateUniqueUsername', () => {
  const model = (taken) => ({
    findOne: jest.fn(({ username }) => ({ lean: async () => (taken.includes(username) ? { username } : null) })),
  });

  it('derives from the email local part', async () => {
    expect(await generateUniqueUsername({ profile: { email: 'asha.r@example.com', provider: 'google' }, User: model([]) })).toBe('asha.r');
  });

  it('disambiguates a taken username', async () => {
    expect(await generateUniqueUsername({ profile: { email: 'asha@example.com', provider: 'google' }, User: model(['asha', 'asha2']) })).toBe('asha3');
  });

  it('falls back to the display name when there is no email', async () => {
    expect(await generateUniqueUsername({ profile: { name: 'Ravi K', provider: 'facebook' }, User: model([]) })).toBe('ravik');
  });

  it('falls back to the provider name when there is neither', async () => {
    expect(await generateUniqueUsername({ profile: { provider: 'facebook' }, User: model([]) })).toBe('facebook');
  });

  it('strips characters that do not belong in a username', async () => {
    expect(await generateUniqueUsername({ profile: { email: 'a+b/c<script>@example.com', provider: 'google' }, User: model([]) })).toBe('abcscript');
  });
});
