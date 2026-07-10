const mockClusterInstance = { on: jest.fn(), quit: jest.fn().mockResolvedValue() };
const mockSingleInstance = { on: jest.fn(), quit: jest.fn().mockResolvedValue() };

const MockIORedis = jest.fn().mockImplementation(() => mockSingleInstance);
MockIORedis.Cluster = jest.fn().mockImplementation(() => mockClusterInstance);

jest.mock('ioredis', () => MockIORedis);

describe('config/redis — parseClusterNodes', () => {
  it('parses a comma-separated host:port list', () => {
    const { parseClusterNodes } = require('../src/config/redis');
    expect(parseClusterNodes('node1:6379,node2:6380')).toEqual([
      { host: 'node1', port: 6379 },
      { host: 'node2', port: 6380 },
    ]);
  });

  it('defaults to port 6379 when omitted', () => {
    const { parseClusterNodes } = require('../src/config/redis');
    expect(parseClusterNodes('node1')).toEqual([{ host: 'node1', port: 6379 }]);
  });

  it('returns an empty array for blank input', () => {
    const { parseClusterNodes } = require('../src/config/redis');
    expect(parseClusterNodes('')).toEqual([]);
    expect(parseClusterNodes(undefined)).toEqual([]);
  });
});

describe('config/redis — getRedisConnection mode selection', () => {
  const originalClusterNodes = process.env.REDIS_CLUSTER_NODES;
  const originalUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalClusterNodes === undefined) delete process.env.REDIS_CLUSTER_NODES;
    else process.env.REDIS_CLUSTER_NODES = originalClusterNodes;
    if (originalUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalUrl;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('constructs a single-instance client when REDIS_CLUSTER_NODES is unset', () => {
    delete process.env.REDIS_CLUSTER_NODES;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    jest.resetModules();
    const { getRedisConnection } = require('../src/config/redis');

    const conn = getRedisConnection();

    expect(MockIORedis).toHaveBeenCalledWith('redis://127.0.0.1:6379', expect.objectContaining({ maxRetriesPerRequest: null }));
    expect(MockIORedis.Cluster).not.toHaveBeenCalled();
    expect(conn).toBe(mockSingleInstance);
  });

  it('constructs a Cluster client when REDIS_CLUSTER_NODES is set', () => {
    process.env.REDIS_CLUSTER_NODES = 'node1:6379,node2:6380';
    jest.resetModules();
    const { getRedisConnection } = require('../src/config/redis');

    const conn = getRedisConnection();

    expect(MockIORedis.Cluster).toHaveBeenCalledWith(
      [{ host: 'node1', port: 6379 }, { host: 'node2', port: 6380 }],
      expect.objectContaining({ redisOptions: expect.objectContaining({ maxRetriesPerRequest: null }) })
    );
    expect(conn).toBe(mockClusterInstance);
  });

  it('reuses the same connection on repeated calls (singleton)', () => {
    delete process.env.REDIS_CLUSTER_NODES;
    jest.resetModules();
    const { getRedisConnection } = require('../src/config/redis');

    const first = getRedisConnection();
    const second = getRedisConnection();

    expect(first).toBe(second);
    expect(MockIORedis).toHaveBeenCalledTimes(1);
  });
});
