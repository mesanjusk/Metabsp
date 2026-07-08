import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import apiClient from '../../apiClient';

vi.mock('../../apiClient', () => ({
  default: { get: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminAnalyticsPanel', () => {
  it('renders stat tiles and the top-tenants chart from the overview response', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        data: {
          tenantCount: 5,
          activeSubscriptionCount: 3,
          revenueInPaiseThisPeriod: 199900,
          totalMessagesThisPeriod: 1234,
          topTenantsByUsage: [{ tenantId: 't1', tenantName: 'Acme Inc', messageCount: 800 }],
        },
      },
    });

    render(<AdminAnalyticsPanel />);

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('₹1,999')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText(/top tenants by messages sent/i)).toBeInTheDocument();
  });

  it('shows an empty state when there is no tenant usage yet', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        data: {
          tenantCount: 0,
          activeSubscriptionCount: 0,
          revenueInPaiseThisPeriod: 0,
          totalMessagesThisPeriod: 0,
          topTenantsByUsage: [],
        },
      },
    });

    render(<AdminAnalyticsPanel />);

    expect(await screen.findByText(/no tenant usage yet/i)).toBeInTheDocument();
  });

  it('surfaces a friendly error when the request fails', async () => {
    apiClient.get.mockRejectedValue({});

    render(<AdminAnalyticsPanel />);

    expect(await screen.findByText(/could not load admin analytics/i)).toBeInTheDocument();
  });
});
