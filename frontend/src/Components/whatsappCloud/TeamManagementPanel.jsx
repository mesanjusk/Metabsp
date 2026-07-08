import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';
import { fetchWhatsAppAccounts, fetchTeamMembers, addTeamMember, removeTeamMember } from '../../services/whatsappCloudService';

// Lets the account owner share one connected WhatsApp number with other
// platform users (shared team inbox — see backend/src/services/teamService.js
// and the teamMemberIds fallback in whatsappAccountService.js). A team
// member added here gets full view/reply access to this account's
// conversations the next time they log in; no separate invite flow yet
// since it's an existing-user-by-mobile lookup.
export default function TeamManagementPanel() {
  const [accountId, setAccountId] = useState('');
  const [members, setMembers] = useState([]);
  const [mobile, setMobile] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const accountsRes = await fetchWhatsAppAccounts();
      const accounts = accountsRes?.data?.data || accountsRes?.data || [];
      const active = (Array.isArray(accounts) ? accounts : []).find((a) => a.isActive) || accounts[0];
      if (!active) {
        setAccountId('');
        setMembers([]);
        return;
      }
      const id = active.id || active._id;
      setAccountId(id);
      const membersRes = await fetchTeamMembers(id);
      setMembers(membersRes?.data?.data || []);
    } catch (err) {
      setError(parseApiError(err, 'Could not load team members.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!accountId) return toast.error('Connect a WhatsApp number first.');
    if (!mobile.trim()) return toast.error('Enter the team member\'s mobile number.');

    setIsSaving(true);
    try {
      await addTeamMember(accountId, mobile.trim());
      toast.success('Team member added.');
      setMobile('');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not add team member.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (memberId) => {
    try {
      await removeTeamMember(accountId, memberId);
      toast.success('Team member removed.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not remove team member.'));
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Team inbox</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Add other platform users (by their login mobile number) so they can view and reply to this WhatsApp number's conversations.
      </Typography>

      {error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={handleAdd} sx={{ mb: 1.5 }}>
        <TextField size="small" label="Team member's mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} fullWidth />
        <Button type="submit" variant="contained" disabled={isSaving || !accountId}>{isSaving ? 'Adding…' : 'Add'}</Button>
      </Stack>

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Loading team members...</Typography>
        </Stack>
      ) : members.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No team members added yet — you're the only one with access.</Typography>
      ) : (
        <List dense disablePadding>
          {members.map((member) => (
            <ListItem
              key={member.id}
              divider
              secondaryAction={
                <Button size="small" color="error" variant="text" onClick={() => handleRemove(member.id)}>
                  Remove
                </Button>
              }
            >
              <ListItemText primary={member.name || member.mobile} secondary={member.mobile} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
