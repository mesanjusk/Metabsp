import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamManagementPanel from './TeamManagementPanel';
import { fetchWhatsAppAccounts, fetchTeamMembers, addTeamMember, removeTeamMember } from '../../services/whatsappCloudService';

vi.mock('../../services/whatsappCloudService', () => ({
  fetchWhatsAppAccounts: vi.fn(),
  fetchTeamMembers: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
}));

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const accounts = [{ _id: 'acc-1', isActive: true, displayPhoneNumber: '+1 555 0100' }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TeamManagementPanel', () => {
  it('lists existing team members for the active account', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    fetchTeamMembers.mockResolvedValue({ data: { data: [{ id: 'user-2', name: 'Agent Two', mobile: '9000000002' }] } });

    render(<TeamManagementPanel />);

    expect(await screen.findByText('Agent Two')).toBeInTheDocument();
    expect(fetchTeamMembers).toHaveBeenCalledWith('acc-1');
  });

  it('shows an empty state with no team members', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    fetchTeamMembers.mockResolvedValue({ data: { data: [] } });

    render(<TeamManagementPanel />);

    expect(await screen.findByText(/no team members added yet/i)).toBeInTheDocument();
  });

  it('adds a team member by mobile number', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    fetchTeamMembers.mockResolvedValue({ data: { data: [] } });
    addTeamMember.mockResolvedValue({ data: { success: true } });

    render(<TeamManagementPanel />);
    await screen.findByText(/no team members added yet/i);

    await userEvent.type(screen.getByLabelText(/team member's mobile number/i), '9000000002');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(addTeamMember).toHaveBeenCalledWith('acc-1', '9000000002'));
  });

  it('removes a team member', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: accounts } });
    fetchTeamMembers.mockResolvedValue({ data: { data: [{ id: 'user-2', name: 'Agent Two', mobile: '9000000002' }] } });
    removeTeamMember.mockResolvedValue({ data: { success: true } });

    render(<TeamManagementPanel />);
    await screen.findByText('Agent Two');

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(removeTeamMember).toHaveBeenCalledWith('acc-1', 'user-2'));
  });

  it('shows an empty state when there is no connected account', async () => {
    fetchWhatsAppAccounts.mockResolvedValue({ data: { data: [] } });

    render(<TeamManagementPanel />);

    expect(await screen.findByText(/no team members added yet/i)).toBeInTheDocument();
  });
});
