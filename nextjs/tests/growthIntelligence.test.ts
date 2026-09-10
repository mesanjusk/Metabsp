import { describe, expect, it } from 'vitest';
import { buildGrowthAgents, buildGrowthRecommendations } from '@/lib/services/growthIntelligence';

const base = {
  activeOpportunities: 0,
  overdueFollowUps: 0,
  unansweredConversations: 0,
  reactivationCandidates: 0,
  whatsappConnected: true,
  instagramConnected: true,
  marketingEnabled: true,
  googleBusinessLive: true,
};

describe('growth intelligence', () => {
  it('prioritises unanswered conversations and overdue lead follow-up', () => {
    const recommendations = buildGrowthRecommendations({
      ...base,
      unansweredConversations: 3,
      overdueFollowUps: 5,
    });

    expect(recommendations.map((item) => item.id)).toEqual(['reply-now', 'follow-up']);
    expect(recommendations[0]).toMatchObject({ priority: 'urgent', count: 3, href: '/inbox' });
    expect(recommendations[1]).toMatchObject({ priority: 'high', count: 5, href: '/contacts' });
  });

  it('uses the existing Pro Marketing entitlement instead of bypassing it', () => {
    const locked = buildGrowthRecommendations({
      ...base,
      marketingEnabled: false,
      reactivationCandidates: 8,
    }).find((item) => item.id === 'reactivate');

    expect(locked).toMatchObject({ priority: 'medium', href: '/contacts', actionLabel: 'Review customers' });

    const enabled = buildGrowthRecommendations({
      ...base,
      marketingEnabled: true,
      reactivationCandidates: 8,
    }).find((item) => item.id === 'reactivate');

    expect(enabled).toMatchObject({ priority: 'high', href: '/services/marketing', actionLabel: 'Create campaign' });
  });

  it('flags missing channels without creating alternate provider flows', () => {
    const recommendations = buildGrowthRecommendations({
      ...base,
      whatsappConnected: false,
      instagramConnected: false,
      googleBusinessLive: false,
    });

    expect(recommendations.map((item) => item.id)).toEqual([
      'connect-whatsapp',
      'connect-instagram',
      'google-business',
    ]);
  });

  it('does not treat basic Google Business entitlement as a live provider connection', () => {
    const recommendations = buildGrowthRecommendations({ ...base, googleBusinessLive: false });
    expect(recommendations.find((item) => item.id === 'google-business')).toBeTruthy();
  });

  it('reports agent state from live connections and entitlements', () => {
    const agents = buildGrowthAgents({
      ...base,
      activeOpportunities: 11,
      unansweredConversations: 2,
      reactivationCandidates: 4,
      whatsappConnected: false,
      marketingEnabled: false,
      googleBusinessLive: false,
    });

    expect(agents.support).toMatchObject({ status: 'setup', metric: 2 });
    expect(agents.marketing).toMatchObject({ status: 'locked', metric: 4 });
    expect(agents.localGrowth.status).toBe('next');
    expect(agents.analyst).toMatchObject({ status: 'live', metric: 11 });
  });
});
