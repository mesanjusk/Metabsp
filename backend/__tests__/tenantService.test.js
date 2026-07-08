// Requires downloading a real mongod binary via mongodb-memory-server, which
// this sandbox's network policy blocks (fastdl.mongodb.org is denied) — not
// verified in this environment, but should run in CI / any dev machine with
// normal internet access.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Organization = require('../bulk/models/Organization');
const User = require('../bulk/models/User');
const Role = require('../bulk/models/Role');
const { ensureTenantForUser } = require('../src/services/tenantService');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Promise.all([Organization.deleteMany({}), User.deleteMany({}), Role.deleteMany({})]);
});

async function makeUser(overrides = {}) {
  const role = await Role.create({ name: 'User', code: 'METABSP_USER', permissions: [], tenantId: null });
  return User.create({
    name: 'Alice Cloud',
    username: 'alice',
    password: 'hashed-in-real-flow',
    mobile: '9999999999',
    roleId: role._id,
    tenantId: null,
    ...overrides,
  });
}

describe('tenantService.ensureTenantForUser', () => {
  it('creates a new Organization for a user with no existing tenant', async () => {
    const user = await makeUser();
    const tenantId = await ensureTenantForUser(user._id);

    const org = await Organization.findById(tenantId);
    expect(org).not.toBeNull();
    expect(org.mobile).toBe('9999999999');
    expect(org.createdVia).toBe('whatsapp_cloud_signup');
  });

  it('is idempotent — calling it twice for the same mobile reuses the same Organization', async () => {
    const user = await makeUser();
    const first = await ensureTenantForUser(user._id);
    const second = await ensureTenantForUser(user._id);

    expect(String(first)).toBe(String(second));
    expect(await Organization.countDocuments()).toBe(1);
  });

  it('links to an existing Organization sharing the same mobile (e.g. from the Bulk product)', async () => {
    const existingOrg = await Organization.create({ name: 'Existing Biz', mobile: '8888888888' });
    const user = await makeUser({ mobile: '8888888888', username: 'bob' });

    const tenantId = await ensureTenantForUser(user._id);

    expect(String(tenantId)).toBe(String(existingOrg._id));
    expect(await Organization.countDocuments()).toBe(1);
  });

  it('never writes to User.tenantId (would break the tenantId:null login lookup)', async () => {
    const user = await makeUser();
    await ensureTenantForUser(user._id);

    const reloaded = await User.findById(user._id);
    expect(reloaded.tenantId).toBeNull();
  });

  it('falls back to a synthetic mobile placeholder when the user has none on file', async () => {
    const user = await makeUser({ mobile: '' });
    const tenantId = await ensureTenantForUser(user._id);

    const org = await Organization.findById(tenantId);
    expect(org.mobile).toBe(`cloud-user-${user._id}`);
  });
});
