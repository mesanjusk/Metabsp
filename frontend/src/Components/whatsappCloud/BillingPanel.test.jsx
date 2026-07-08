import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPanel from './BillingPanel';
import {
  fetchBillingPlans,
  fetchCurrentSubscription,
  subscribeToPlan,
  fetchInvoices,
  downloadInvoicePdf,
} from '../../services/billingService';

vi.mock('../../services/billingService', () => ({
  fetchBillingPlans: vi.fn(),
  fetchCurrentSubscription: vi.fn(),
  subscribeToPlan: vi.fn(),
  fetchInvoices: vi.fn(),
  downloadInvoicePdf: vi.fn(),
}));

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const plans = [
  { _id: 'plan-1', name: 'Starter', priceInPaise: 99900, billingInterval: 'monthly', includedMessages: 1000, overagePricePerMessageInPaise: 20 },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.open = vi.fn();
});

describe('BillingPanel', () => {
  it('shows "no active subscription" and lists plans when nothing is subscribed', async () => {
    fetchBillingPlans.mockResolvedValue({ data: { data: plans } });
    fetchCurrentSubscription.mockResolvedValue({ data: { data: null } });
    fetchInvoices.mockResolvedValue({ data: { data: [] } });

    render(<BillingPanel />);

    expect(await screen.findByText(/no active subscription yet/i)).toBeInTheDocument();
    expect(screen.getByText(/starter/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe via upi/i })).toBeInTheDocument();
  });

  it('shows the active subscription status when one exists', async () => {
    fetchBillingPlans.mockResolvedValue({ data: { data: plans } });
    fetchCurrentSubscription.mockResolvedValue({
      data: { data: { status: 'active', planId: { name: 'Starter' } } },
    });
    fetchInvoices.mockResolvedValue({ data: { data: [] } });

    render(<BillingPanel />);

    expect(await screen.findByText(/current plan:/i)).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('opens the UPI authorization link in a new tab when subscribing', async () => {
    fetchBillingPlans.mockResolvedValue({ data: { data: plans } });
    fetchCurrentSubscription.mockResolvedValue({ data: { data: null } });
    fetchInvoices.mockResolvedValue({ data: { data: [] } });
    subscribeToPlan.mockResolvedValue({ data: { data: { authorizationLink: 'https://upi.example/authorize' } } });

    render(<BillingPanel />);
    await screen.findByText(/starter/i);

    await userEvent.click(screen.getByRole('button', { name: /subscribe via upi/i }));

    await waitFor(() => expect(subscribeToPlan).toHaveBeenCalledWith('plan-1'));
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://upi.example/authorize', '_blank', 'noopener,noreferrer'));
  });

  it('lists invoices and triggers a PDF download', async () => {
    fetchBillingPlans.mockResolvedValue({ data: { data: [] } });
    fetchCurrentSubscription.mockResolvedValue({ data: { data: null } });
    fetchInvoices.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'inv-1',
            invoiceNumber: 'INV-20260701-0001',
            status: 'paid',
            totalAmountInPaise: 99900,
            periodStart: '2026-07-01',
            periodEnd: '2026-07-31',
          },
        ],
      },
    });

    render(<BillingPanel />);
    await screen.findByText('INV-20260701-0001');

    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(downloadInvoicePdf).toHaveBeenCalledWith('inv-1', 'INV-20260701-0001'));
  });
});
