import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowManagementPanel from './WorkflowManagementPanel';
import { getWorkflows, createWorkflow, deleteWorkflow, toggleWorkflow } from '../../services/whatsappCloudService';

vi.mock('../../services/whatsappCloudService', () => ({
  getWorkflows: vi.fn(),
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  toggleWorkflow: vi.fn(),
}));

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const workflows = [
  { _id: 'wf-1', name: 'Welcome sequence', keyword: 'hi', matchType: 'contains', isActive: true, steps: [{ reply: 'Hello!' }, { reply: 'How can we help?' }] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WorkflowManagementPanel', () => {
  it('lists existing workflows with their step count', async () => {
    getWorkflows.mockResolvedValue({ data: { data: workflows } });

    render(<WorkflowManagementPanel search="" />);

    expect(await screen.findByText('Welcome sequence')).toBeInTheDocument();
    expect(screen.getByText('2 steps')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows an empty state with no workflows', async () => {
    getWorkflows.mockResolvedValue({ data: { data: [] } });

    render(<WorkflowManagementPanel search="" />);

    expect(await screen.findByText(/no workflows configured/i)).toBeInTheDocument();
  });

  it('creates a new workflow with a single step', async () => {
    getWorkflows.mockResolvedValue({ data: { data: [] } });
    createWorkflow.mockResolvedValue({ data: { success: true } });

    render(<WorkflowManagementPanel search="" />);
    await screen.findByText(/no workflows configured/i);

    await userEvent.click(screen.getByRole('button', { name: /new workflow/i }));
    await userEvent.type(screen.getByLabelText(/workflow name/i), 'Onboarding');
    await userEvent.type(screen.getByLabelText(/trigger keyword/i), 'start');
    // paste, not type: userEvent.type on this multiline autosizing field is
    // flaky under jsdom (each keystroke triggers a resize recalculation).
    await userEvent.click(screen.getByLabelText(/^reply$/i));
    await userEvent.paste('Welcome aboard!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Onboarding', keyword: 'start', steps: [expect.objectContaining({ reply: 'Welcome aboard!' })] })
      )
    );
  });

  it('deletes a workflow', async () => {
    getWorkflows.mockResolvedValue({ data: { data: workflows } });
    deleteWorkflow.mockResolvedValue({ data: { success: true } });

    render(<WorkflowManagementPanel search="" />);
    await screen.findByText('Welcome sequence');

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(deleteWorkflow).toHaveBeenCalledWith('wf-1'));
  });

  it('toggles a workflow active state', async () => {
    getWorkflows.mockResolvedValue({ data: { data: workflows } });
    toggleWorkflow.mockResolvedValue({ data: { success: true } });

    render(<WorkflowManagementPanel search="" />);
    await screen.findByText('Welcome sequence');

    await userEvent.click(screen.getByText('Active'));

    await waitFor(() => expect(toggleWorkflow).toHaveBeenCalledWith('wf-1'));
  });
});
