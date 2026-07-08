import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PropTypes from 'prop-types';
import Modal from '../common/Modal';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';
import { getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflow } from '../../services/whatsappCloudService';

const emptyStep = () => ({ delaySeconds: 0, replyType: 'text', reply: '', templateLanguage: 'en_US' });

const initialFormState = {
  name: '',
  keyword: '',
  matchType: 'contains',
  active: true,
  steps: [emptyStep()],
};

const normalizeWorkflow = (workflow) => ({
  ...workflow,
  id: workflow.id || workflow._id,
  active: typeof workflow.active === 'boolean' ? workflow.active : Boolean(workflow.isActive),
  steps: Array.isArray(workflow.steps) ? workflow.steps : [],
});

// A minimal, real workflow builder: an ordered sequence of send-message
// steps (each with its own delay) fired when a keyword matches an inbound
// message — see backend/src/services/workflowService.js for the scope note
// (linear single-trigger sequence, not a branching visual canvas).
export default function WorkflowManagementPanel({ search }) {
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWorkflows();
      const list = res?.data?.data || res?.data || [];
      setWorkflows((Array.isArray(list) ? list : []).map(normalizeWorkflow));
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to load workflows.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredWorkflows = normalizedSearch
    ? workflows.filter((wf) => `${wf.name} ${wf.keyword}`.toLowerCase().includes(normalizedSearch))
    : workflows;

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (workflow) => {
    setEditingId(workflow.id);
    setFormData({
      name: workflow.name || '',
      keyword: workflow.keyword || '',
      matchType: workflow.matchType || 'contains',
      active: workflow.active,
      steps: workflow.steps.length ? workflow.steps.map((s) => ({ ...emptyStep(), ...s })) : [emptyStep()],
    });
    setIsModalOpen(true);
  };

  const updateStep = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));
  };

  const addStep = () => setFormData((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  const removeStep = (index) => setFormData((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));

  // Modal's effect depends on onClose and re-arms a "focus the first field"
  // timeout whenever that reference changes — an inline arrow here would
  // change identity on every keystroke (formData updates on every field
  // change) and steal focus back to the first field mid-typing.
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) return toast.error('Workflow name is required.');
    if (!formData.keyword.trim()) return toast.error('Trigger keyword is required.');
    const steps = formData.steps.filter((s) => s.reply.trim());
    if (!steps.length) return toast.error('At least one step with a reply is required.');

    const payload = {
      name: formData.name.trim(),
      keyword: formData.keyword.trim(),
      matchType: formData.matchType,
      isActive: formData.active,
      steps,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await updateWorkflow(editingId, payload);
        toast.success('Workflow updated.');
      } else {
        await createWorkflow(payload);
        toast.success('Workflow created.');
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save workflow.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWorkflow(id);
      toast.success('Workflow deleted.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to delete workflow.'));
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleWorkflow(id);
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to toggle workflow.'));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: { xs: 0, md: 3 }, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Workflows</Typography>
            <Typography variant="body2" color="text.secondary">
              Multi-step message sequences triggered by a keyword — e.g. send a welcome message, wait, then follow up.
            </Typography>
          </Box>
          <Button variant="contained" onClick={openAddModal}>New Workflow</Button>
        </Stack>

        <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Steps</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} align="center">Loading workflows...</TableCell></TableRow> : null}
              {!isLoading && filteredWorkflows.length === 0 ? <TableRow><TableCell colSpan={5} align="center">No workflows configured.</TableCell></TableRow> : null}
              {!isLoading && filteredWorkflows.map((wf) => (
                <TableRow key={wf.id}>
                  <TableCell>{wf.name}</TableCell>
                  <TableCell>{wf.keyword} <Typography component="span" variant="caption">({wf.matchType})</Typography></TableCell>
                  <TableCell>{wf.steps.length} step{wf.steps.length === 1 ? '' : 's'}</TableCell>
                  <TableCell>
                    <Chip label={wf.active ? 'Active' : 'Inactive'} color={wf.active ? 'success' : 'default'} size="small" onClick={() => handleToggle(wf.id)} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => openEditModal(wf)}>Edit</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => handleDelete(wf.id)}>Delete</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>

      {isModalOpen ? (
        <Modal onClose={closeModal} title={editingId ? 'Edit Workflow' : 'New Workflow'}>
          <Stack component="form" onSubmit={handleSave} spacing={1.5}>
            <TextField label="Workflow name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} />
            <TextField label="Trigger keyword" value={formData.keyword} onChange={(e) => setFormData((prev) => ({ ...prev, keyword: e.target.value }))} helperText="Runs instead of any matching Auto Reply rule" />
            <TextField select label="Match Type" value={formData.matchType} onChange={(e) => setFormData((prev) => ({ ...prev, matchType: e.target.value }))}>
              <MenuItem value="contains">Contains</MenuItem>
              <MenuItem value="exact">Exact</MenuItem>
              <MenuItem value="starts_with">Starts with</MenuItem>
            </TextField>

            <Typography variant="subtitle2" fontWeight={700}>Steps (run in order)</Typography>
            <Stack spacing={1.5}>
              {formData.steps.map((step, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" fontWeight={700}>Step {index + 1}</Typography>
                      <IconButton size="small" onClick={() => removeStep(index)} disabled={formData.steps.length === 1}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        type="number"
                        label="Delay (seconds after previous step)"
                        inputProps={{ min: 0, max: 3600 }}
                        value={step.delaySeconds}
                        onChange={(e) => updateStep(index, { delaySeconds: e.target.value })}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                      />
                      <TextField select label="Reply Mode" value={step.replyType} onChange={(e) => updateStep(index, { replyType: e.target.value })} sx={{ width: { xs: '100%', sm: 160 } }}>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="template">Template</MenuItem>
                      </TextField>
                    </Stack>
                    {step.replyType === 'text' ? (
                      <TextField multiline rows={2} label="Reply" value={step.reply} onChange={(e) => updateStep(index, { reply: e.target.value })} />
                    ) : (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField label="Template Name" value={step.reply} onChange={(e) => updateStep(index, { reply: e.target.value })} fullWidth />
                        <TextField label="Language" value={step.templateLanguage} onChange={(e) => updateStep(index, { templateLanguage: e.target.value })} fullWidth />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Button variant="outlined" onClick={addStep} sx={{ width: 'fit-content' }}>Add step</Button>

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button type="button" onClick={closeModal} variant="outlined">Cancel</Button>
              <Button type="submit" disabled={isSaving} variant="contained">{isSaving ? 'Saving...' : 'Save'}</Button>
            </Stack>
          </Stack>
        </Modal>
      ) : null}
    </Paper>
  );
}

WorkflowManagementPanel.propTypes = {
  search: PropTypes.string,
};

WorkflowManagementPanel.defaultProps = {
  search: '',
};
