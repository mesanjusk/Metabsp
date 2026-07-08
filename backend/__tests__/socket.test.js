const mockAdapterInstance = { __mockAdapter: true };
const mockCreateAdapter = jest.fn().mockReturnValue(mockAdapterInstance);
const mockOn = jest.fn();
const MockServer = jest.fn().mockImplementation(() => ({ on: mockOn, emit: jest.fn() }));

jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: mockCreateAdapter }));
jest.mock('socket.io', () => ({ Server: MockServer }));

const mockDuplicate = jest.fn().mockReturnValue({ __mockSubClient: true });
const mockPubClient = { duplicate: mockDuplicate };
jest.mock('../src/config/redis', () => ({ getRedisConnection: jest.fn().mockReturnValue(mockPubClient) }));

const { initSocket } = require('../src/socket');

describe('initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDuplicate.mockReturnValue({ __mockSubClient: true });
  });

  it('wires a Redis pub/sub adapter using a duplicated connection, not the shared singleton, as the subscriber', () => {
    const fakeHttpServer = {};
    initSocket(fakeHttpServer);

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, { __mockSubClient: true });
    expect(MockServer).toHaveBeenCalledWith(
      fakeHttpServer,
      expect.objectContaining({ adapter: mockAdapterInstance })
    );
  });
});
