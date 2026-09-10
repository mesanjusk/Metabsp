export type GrowthRecommendation = {
  id: string;
  agent: 'support' | 'marketing' | 'local-growth' | 'analyst';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  count: number;
  href: string;
  actionLabel: string;
};

export type GrowthInputs = {
  activeOpportunities: number;
  overdueFollowUps: number;
  unansweredConversations: number;
  reactivationCandidates: number;
  whatsappConnected: boolean;
  instagramConnected: boolean;
  marketingEnabled: boolean;
  googleBusinessLive: boolean;
};

export function buildGrowthRecommendations(input: GrowthInputs): GrowthRecommendation[] {
  const recommendations: GrowthRecommendation[] = [];

  if (input.unansweredConversations > 0) {
    recommendations.push({
      id: 'reply-now',
      agent: 'support',
      priority: 'urgent',
      title: `${input.unansweredConversations} conversation${input.unansweredConversations === 1 ? '' : 's'} need attention`,
      detail: 'The latest message is from the customer and has been waiting at least 15 minutes.',
      count: input.unansweredConversations,
      href: '/inbox',
      actionLabel: 'Open inbox',
    });
  }

  if (input.overdueFollowUps > 0) {
    recommendations.push({
      id: 'follow-up',
      agent: 'analyst',
      priority: 'high',
      title: `${input.overdueFollowUps} lead${input.overdueFollowUps === 1 ? '' : 's'} may need follow-up`,
      detail: 'Interested, follow-up or quotation contacts have not been updated for at least 2 days.',
      count: input.overdueFollowUps,
      href: '/contacts',
      actionLabel: 'Review contacts',
    });
  }

  if (input.reactivationCandidates > 0) {
    recommendations.push({
      id: 'reactivate',
      agent: 'marketing',
      priority: input.marketingEnabled ? 'high' : 'medium',
      title: `${input.reactivationCandidates} past customer${input.reactivationCandidates === 1 ? '' : 's'} can be reactivated`,
      detail: input.marketingEnabled
        ? 'These converted customers have been inactive for 30+ days. Build a repeat-business campaign from the shared contact base.'
        : 'These converted customers have been inactive for 30+ days. Marketing service access is required to run a campaign.',
      count: input.reactivationCandidates,
      href: input.marketingEnabled ? '/services/marketing' : '/contacts',
      actionLabel: input.marketingEnabled ? 'Create campaign' : 'Review customers',
    });
  }

  if (!input.whatsappConnected) {
    recommendations.push({
      id: 'connect-whatsapp',
      agent: 'support',
      priority: 'high',
      title: 'Connect WhatsApp to activate customer support automation',
      detail: 'The shared inbox and conversation intelligence become useful after a live WhatsApp Business connection is available.',
      count: 0,
      href: '/inbox',
      actionLabel: 'Open WhatsApp',
    });
  }

  if (!input.instagramConnected) {
    recommendations.push({
      id: 'connect-instagram',
      agent: 'marketing',
      priority: 'medium',
      title: 'Connect Instagram to unify social conversations',
      detail: 'Instagram can use the same tenant, contacts and service layer instead of creating a separate customer database.',
      count: 0,
      href: '/instagram',
      actionLabel: 'Open Instagram',
    });
  }

  if (!input.googleBusinessLive) {
    recommendations.push({
      id: 'google-business',
      agent: 'local-growth',
      priority: 'low',
      title: 'Google Business Profile is the next local-growth channel',
      detail: 'The service stays marked as upcoming until a real provider connection exists; access entitlement alone never counts as connected.',
      count: 0,
      href: '/services/google-business',
      actionLabel: 'View service',
    });
  }

  return recommendations;
}

export function buildGrowthAgents(input: GrowthInputs) {
  return {
    support: {
      status: input.whatsappConnected ? 'live' : 'setup',
      metric: input.unansweredConversations,
      metricLabel: 'need attention',
    },
    marketing: {
      status: input.marketingEnabled ? 'live' : 'locked',
      metric: input.reactivationCandidates,
      metricLabel: 'reactivation candidates',
    },
    localGrowth: {
      status: input.googleBusinessLive ? 'live' : 'next',
      metric: 0,
      metricLabel: input.googleBusinessLive ? 'service connected' : 'Google Business next',
    },
    analyst: {
      status: 'live',
      metric: input.activeOpportunities,
      metricLabel: 'active opportunities',
    },
  };
}
