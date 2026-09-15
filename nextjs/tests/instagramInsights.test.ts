import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/db/mongo', () => ({ connectDB: vi.fn() }));
vi.mock('@/lib/instagram/access', () => ({ requireInstagramService: vi.fn().mockResolvedValue({ id: 'test-user' }) }));
vi.mock('@/lib/instagram/meta', () => ({
  getInstagramAccess: vi.fn().mockResolvedValue({ account: { instagramUserId: 'test-account' }, accessToken: 'test-token' }),
  instagramGraphRequest: vi.fn(),
}));
import { instagramGraphRequest } from '@/lib/instagram/meta';
import { GET } from '@/app/api/instagram/insights/route';
const graph = vi.mocked(instagramGraphRequest);
describe('Instagram overview counts', () => {
  beforeEach(() => graph.mockReset());
  it('marks a first page as a lower bound when more conversations exist', async () => {
    graph.mockResolvedValueOnce({ followers_count: 123 }).mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, id) => ({ id })), paging: { next: 'https://graph.instagram.com/next' } });
    const body = await (await GET(new NextRequest('http://localhost/api/instagram/insights'))).json();
    expect(body.data).toMatchObject({ openConversations: 50, conversationsHasMore: true, conversationsAvailable: true });
  });
  it('distinguishes an empty inbox from unavailable conversation data', async () => {
    graph.mockResolvedValueOnce({}).mockResolvedValueOnce({ data: [] });
    const empty = await (await GET(new NextRequest('http://localhost/api/instagram/insights'))).json();
    expect(empty.data).toMatchObject({ openConversations: 0, conversationsHasMore: false, conversationsAvailable: true });
    graph.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Provider unavailable'));
    const unavailable = await (await GET(new NextRequest('http://localhost/api/instagram/insights'))).json();
    expect(unavailable.data.conversationsAvailable).toBe(false);
  });
});
