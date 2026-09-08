'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';
import { toast } from '@/lib/ui/components/Toast';

const EMPTY_PROFILE = {
  about: '',
  address: '',
  description: '',
  email: '',
  vertical: 'OTHER',
  websites: ['', ''],
};

const VERTICALS = [
  'AUTOMOTIVE',
  'BEAUTY_SPA_AND_SALON',
  'CLOTHING_AND_APPAREL',
  'EDUCATION',
  'ENTERTAINMENT',
  'EVENT_PLANNING_AND_SERVICE',
  'FINANCE_AND_BANKING',
  'FOOD_AND_GROCERY',
  'HOTEL_AND_LODGING',
  'MEDICAL_AND_HEALTH',
  'NON_PROFIT',
  'PROFESSIONAL_SERVICES',
  'PUBLIC_SERVICE',
  'RESTAURANT',
  'SHOPPING_AND_RETAIL',
  'TRAVEL_AND_TRANSPORTATION',
  'OTHER',
];

const FLOW_CATEGORIES = [
  'SIGN_UP',
  'SIGN_IN',
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
];

function SectionError({ value }) {
  if (!value) return null;
  return <Alert severity="warning" sx={{ mb: 2 }}>{value}</Alert>;
}

function normalizeProfile(raw) {
  const source = raw || {};
  const websites = Array.isArray(source.websites) ? source.websites : [];
  return {
    about: source.about || '',
    address: source.address || '',
    description: source.description || '',
    email: source.email || '',
    vertical: source.vertical || 'OTHER',
    websites: [websites[0] || '', websites[1] || ''],
  };
}

export default function BusinessToolsPanel() {
  const [tab, setTab] = useState('profile');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [cartEnabled, setCartEnabled] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMessage, setQrMessage] = useState('Hi, I found your business on WhatsApp.');
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowCategory, setFlowCategory] = useState('OTHER');
  const [flowEndpoint, setFlowEndpoint] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/whatsapp/business-tools');
      const data = response?.data || {};
      setSnapshot(data);
      if (data.profile?.data) setProfile(normalizeProfile(data.profile.data));
      if (data.commerce?.data) {
        setCatalogVisible(Boolean(data.commerce.data.is_catalog_visible));
        setCartEnabled(Boolean(data.commerce.data.is_cart_enabled));
      }
    } catch (error) {
      toast.error(parseApiError(error, 'Could not load WhatsApp business tools.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (payload, successMessage) => {
    setSaving(true);
    try {
      await apiClient.post('/api/whatsapp/business-tools', payload);
      toast.success(successMessage);
      await load();
      return true;
    } catch (error) {
      toast.error(parseApiError(error, 'Meta could not complete this action.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const qrCodes = useMemo(() => snapshot?.qrCodes?.data || [], [snapshot]);
  const flows = useMemo(() => snapshot?.flows?.data || [], [snapshot]);

  if (loading && !snapshot) {
    return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={28} /></Stack>;
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography fontWeight={700}>{snapshot?.account?.verifiedName || 'Connected WhatsApp business'}</Typography>
              <Typography variant="body2" color="text.secondary">{snapshot?.account?.displayPhoneNumber || snapshot?.account?.phoneNumberId}</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={load}>Refresh from Meta</Button>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} variant="scrollable" scrollButtons="auto">
          <Tab value="profile" label="Business profile" />
          <Tab value="catalog" label="Catalogue & cart" />
          <Tab value="qr" label="QR codes" />
          <Tab value="flows" label="Flows" />
        </Tabs>
      </Box>

      {tab === 'profile' ? (
        <Card>
          <CardHeader title="WhatsApp business profile" subheader="Changes are written directly to the business profile for the active WhatsApp number." />
          <CardContent>
            <SectionError value={snapshot?.profile?.error} />
            {snapshot?.profile?.data?.profile_picture_url ? (
              <Box component="img" src={snapshot.profile.data.profile_picture_url} alt="WhatsApp business profile" sx={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', mb: 2 }} />
            ) : null}
            <Stack spacing={2}>
              <TextField label="About" value={profile.about} onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value }))} />
              <TextField label="Description" multiline minRows={3} value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} />
              <TextField label="Address" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
              <TextField label="Email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
              <TextField select label="Industry" value={profile.vertical} onChange={(e) => setProfile((p) => ({ ...p, vertical: e.target.value }))}>
                {VERTICALS.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Website 1" value={profile.websites[0]} onChange={(e) => setProfile((p) => ({ ...p, websites: [e.target.value, p.websites[1]] }))} />
              <TextField label="Website 2" value={profile.websites[1]} onChange={(e) => setProfile((p) => ({ ...p, websites: [p.websites[0], e.target.value] }))} />
              <Box><Button variant="contained" disabled={saving || Boolean(snapshot?.profile?.error)} onClick={() => runAction({ action: 'update_profile', profile }, 'Business profile updated.')}>Save profile</Button></Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'catalog' ? (
        <Card>
          <CardHeader title="Catalogue & cart" subheader="Control the catalogue experience customers see on this WhatsApp number." />
          <CardContent>
            <SectionError value={snapshot?.commerce?.error} />
            <Stack spacing={2}>
              <FormControlLabel control={<Switch checked={catalogVisible} onChange={(e) => setCatalogVisible(e.target.checked)} />} label="Show catalogue in WhatsApp" />
              <FormControlLabel control={<Switch checked={cartEnabled} onChange={(e) => setCartEnabled(e.target.checked)} />} label="Allow customers to use cart" />
              <Box>
                <Button variant="contained" disabled={saving || Boolean(snapshot?.commerce?.error)} onClick={() => runAction({ action: 'update_commerce', isCatalogVisible: catalogVisible, isCartEnabled: cartEnabled }, 'Catalogue settings updated.')}>Save catalogue settings</Button>
              </Box>
              <Alert severity="info">
                Product/item creation and inventory editing use Meta's separate Catalog/Commerce asset APIs. Your current approved WhatsApp permissions safely support profile, catalogue visibility, cart behavior, QR codes, Flows, templates and messaging; full product CRUD should only be enabled after the customer catalog asset and the additional Meta catalog/business permissions are granted.
              </Alert>
              <Box>
                <Button component="a" href="https://business.facebook.com/commerce/" target="_blank" rel="noopener" variant="outlined" endIcon={<OpenInNewRoundedIcon />}>Open Meta Commerce Manager</Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'qr' ? (
        <Card>
          <CardHeader title="WhatsApp QR codes" subheader="Create click-to-chat QR codes with a prefilled message." action={<Button startIcon={<AddRoundedIcon />} variant="contained" size="small" onClick={() => setQrOpen(true)}>New QR</Button>} />
          <CardContent>
            <SectionError value={snapshot?.qrCodes?.error} />
            {!qrCodes.length ? <Typography color="text.secondary">No QR codes yet.</Typography> : (
              <Stack spacing={2}>
                {qrCodes.map((qr) => (
                  <Card key={qr.code} variant="outlined">
                    <CardContent>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          {qr.qr_image_url ? <Box component="img" src={qr.qr_image_url} alt="WhatsApp QR" sx={{ width: 84, height: 84 }} /> : null}
                          <Box>
                            <Typography fontWeight={700}>{qr.prefilled_message}</Typography>
                            <Typography variant="caption" color="text.secondary">{qr.code}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          {qr.deep_link_url ? <Button component="a" href={qr.deep_link_url} target="_blank" rel="noopener" size="small">Open link</Button> : null}
                          <Button color="error" size="small" startIcon={<DeleteOutlineRoundedIcon />} disabled={saving} onClick={() => runAction({ action: 'delete_qr', code: qr.code }, 'QR code deleted.')}>Delete</Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'flows' ? (
        <Card>
          <CardHeader title="WhatsApp Flows" subheader="Create and manage structured WhatsApp experiences such as lead forms, bookings, support and surveys." action={<Button startIcon={<AddRoundedIcon />} variant="contained" size="small" onClick={() => setFlowOpen(true)}>New Flow</Button>} />
          <CardContent>
            <SectionError value={snapshot?.flows?.error} />
            {!flows.length ? <Typography color="text.secondary">No Flows yet.</Typography> : (
              <Stack spacing={1.5}>
                {flows.map((flow) => (
                  <Card key={flow.id} variant="outlined">
                    <CardContent>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={700}>{flow.name}</Typography>
                            <Chip size="small" label={flow.status || 'UNKNOWN'} color={flow.status === 'PUBLISHED' ? 'success' : 'default'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">{(flow.categories || []).join(', ') || 'OTHER'}</Typography>
                          {flow.validation_errors?.length ? <Typography variant="caption" color="error">{flow.validation_errors[0]?.message || 'Flow has validation errors'}</Typography> : null}
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {flow.status === 'DRAFT' ? <Button size="small" disabled={saving} onClick={() => runAction({ action: 'publish_flow', flowId: flow.id }, 'Flow published.')}>Publish</Button> : null}
                          {flow.status === 'PUBLISHED' ? <Button size="small" color="warning" disabled={saving} onClick={() => runAction({ action: 'deprecate_flow', flowId: flow.id }, 'Flow deprecated.')}>Deprecate</Button> : null}
                          {flow.status === 'DRAFT' ? <Button size="small" color="error" disabled={saving} onClick={() => runAction({ action: 'delete_flow', flowId: flow.id }, 'Flow deleted.')}>Delete</Button> : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create WhatsApp QR code</DialogTitle>
        <DialogContent><TextField autoFocus fullWidth multiline minRows={3} sx={{ mt: 1 }} label="Prefilled message" value={qrMessage} onChange={(e) => setQrMessage(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => setQrOpen(false)}>Cancel</Button><Button variant="contained" disabled={saving || !qrMessage.trim()} onClick={async () => { if (await runAction({ action: 'create_qr', prefilledMessage: qrMessage }, 'QR code created.')) setQrOpen(false); }}>Create</Button></DialogActions>
      </Dialog>

      <Dialog open={flowOpen} onClose={() => setFlowOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create WhatsApp Flow</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label="Flow name" value={flowName} onChange={(e) => setFlowName(e.target.value)} />
            <TextField select label="Category" value={flowCategory} onChange={(e) => setFlowCategory(e.target.value)}>{FLOW_CATEGORIES.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</TextField>
            <TextField label="Endpoint URL (optional)" placeholder="https://example.com/flow" value={flowEndpoint} onChange={(e) => setFlowEndpoint(e.target.value)} />
            <Alert severity="info">Creating a Flow makes the Meta Flow asset. Add its screens/data model in Meta's Flow editor/API before publishing if validation requires it.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setFlowOpen(false)}>Cancel</Button><Button variant="contained" disabled={saving || !flowName.trim()} onClick={async () => { const ok = await runAction({ action: 'create_flow', name: flowName, categories: [flowCategory], endpointUri: flowEndpoint }, 'Flow created.'); if (ok) { setFlowOpen(false); setFlowName(''); setFlowEndpoint(''); } }}>Create</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
