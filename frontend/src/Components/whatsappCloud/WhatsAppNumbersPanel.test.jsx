import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhatsAppNumbersPanel from './WhatsAppNumbersPanel';
import {
  fetchWhatsAppAccounts,
  activateWhatsAppAccount,
  deleteWhatsAppAccount,
} from '../../services/whatsappCloudService';

vi.mock('../../services/whatsappCloudService', () => ({
  fetchWhatsAppAccounts: vi.fn(),
  activateWhatsAppAccount: vi.fn(),
  deleteWhatsAppAccount: vi.fn(),
}));

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const accounts = [
  { _id: 'acc-1', displayPhoneNumber: '+1 555 0100', phoneNumberId: '1', verifiedName: 'Acme Support', isActive: true, status: 'active' },
  { _id: 'acc-2', displayPhoneNumber: '+1 555 0200', phoneNumberId: '2', verifiedName: 'Acme Sales', isActive: false, status: 'active' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WhatsAppNumbersPanel', () => {
  it('lists every connected account, marking the active one', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });

    render(<WhatsAppNumbersPanel />);

    expect(await screen.findByText('Acme Support')).toBeInTheDocument();
    expect(screen.getByText('Acme Sales')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to this/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no connected numbers', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: [] } });

    render(<WhatsAppNumbersPanel />);

    expect(await screen.findByText(/no whatsapp numbers connected yet/i)).toBeInTheDocument();
  });

  it('activates the inactive account when "Switch to this" is clicked', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    activateWhatsAppAccount.mockResolvedValue({ data: { success: true } });
    const onChanged = vi.fn();

    render(<WhatsAppNumbersPanel onChanged={onChanged} />);
    await screen.findByText('Acme Sales');

    await userEvent.click(screen.getByRole('button', { name: /switch to this/i }));

    await waitFor(() => expect(activateWhatsAppAccount).toHaveBeenCalledWith('acc-2'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('removes an account when "Remove" is clicked', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    deleteWhatsAppAccount.mockResolvedValue({ data: { success: true } });

    render(<WhatsAppNumbersPanel />);
    await screen.findByText('Acme Support');

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => expect(deleteWhatsAppAccount).toHaveBeenCalledWith('acc-1'));
  });

  it('surfaces a friendly error when the account list fails to load', async () => {
    // No .response or .message on the rejection, so parseApiError falls
    // through to the fallback string this component passes it.
    fetchWhatsAppAccounts.mockRejectedValue({});

    render(<WhatsAppNumbersPanel />);

    expect(await screen.findByText(/could not load connected whatsapp numbers/i)).toBeInTheDocument();
  });
});
