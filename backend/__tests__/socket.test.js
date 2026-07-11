const mockAdapterInstance = { __mockAdapter: true };
const mockCreateAdapter = jest.fn().mockReturnValue(mockAdapterInstance);
const mockOn = jest.fn();
const MockServer = jest.fn().mockImplementation(() => ({ on: mockOn, emit: jest.fn() }));

jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: mockCreateAdapter }));
jest.mock('socket.io', () => ({ Server: MockServer }));

const mockSubClientOn = jest.fn();
const mockDuplicate = jest.fn().mockReturnValue({ __mockSubClient: true, on: mockSubClientOn });
const mockPubClient = { duplicate: mockDuplicate };
jest.mock('../src/config/redis', () => ({ getRedisConnection: jest.fn().mockReturnValue(mockPubClient) }));

const { initSocket } = require('../src/socket');

describe('initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDuplicate.mockReturnValue({ __mockSubClient: true, on: mockSubClientOn });
  });

  it('wires a Redis pub/sub adapter using a duplicated connection, not the shared singleton, as the subscriber', () => {
    const fakeHttpServer = {};
    initSocket(fakeHttpServer);

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, { __mockSubClient: true, on: mockSubClientOn });
    expect(MockServer).toHaveBeenCalledWith(
      fakeHttpServer,
      expect.objectContaining({ adapter: mockAdapterInstance })
    );
  });

  it('attaches an error listener to the duplicated subscriber connection, since duplicate() does not inherit one', () => {
    initSocket({});

    expect(mockSubClientOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
