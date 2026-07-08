import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { toast } from '../Components/Toast';
import {
  connectWhatsAppManual,
  completeWhatsAppConnect,
  fetchWhatsAppConnectConfig,
  disconnectWhatsAppAccount,
  fetchWhatsAppStatus,
  revalidateWhatsAppAccount,
} from '../services/whatsappCloudService';
import { parseApiError } from '../utils/parseApiError';
import { loadFacebookSdk, listenForEmbeddedSignupData } from '../utils/facebookSdk';
import { ErrorState, LoadingSkeleton } from '../Components/ui';
import { useAuth } from '../context/AuthContext';
import WhatsappProviderDialog from '../Components/whatsappCloud/WhatsappProviderDialog';

const MessagesPanel       = lazy(() => import('../Components/whatsappCloud/MessagesPanel'));
const SendMessagePanel    = lazy(() => import('../Components/whatsappCloud/SendMessagePanel'));
const BulkSender          = lazy(() => import('../Components/whatsappCloud/BulkSender'));
const AutoReplyManagementPanel = lazy(() => import('../Components/whatsappCloud/AutoReplyManagementPanel'));
const WorkflowManagementPanel  = lazy(() => import('../Components/whatsappCloud/WorkflowManagementPanel'));
const CRMPanel            = lazy(() => import('../Components/whatsappCloud/CRMPanel'));
const AnalyticsDashboard  = lazy(() => import('../Components/whatsappCloud/AnalyticsDashboard'));
const WhatsAppAttendanceSettings = lazy(() => import('../Components/whatsappCloud/WhatsAppAttendanceSettings'));
const AdminUserManagementPanel   = lazy(() => import('../Components/whatsappCloud/AdminUserManagementPanel'));
const MetaWebhookConfigPanel     = lazy(() => import('../Components/whatsappCloud/MetaWebhookConfigPanel'));
const AdminAnalyticsPanel        = lazy(() => import('../Components/whatsappCloud/AdminAnalyticsPanel'));
const ManualInvitePanel   = lazy(() => import('../Components/whatsappCloud/ManualInvitePanel'));
const CampaignsPanel      = lazy(() => import('../Components/whatsappCloud/CampaignsPanel'));
const BaileysPanel        = lazy(() => import('../Components/whatsappCloud/BaileysPanel'));

// ── Main 4-tab nav ────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { key: 'meta',    label: 'Meta',    icon: <CloudRoundedIcon /> },
  { key: 'baileys', label: 'Baileys', icon: <QrCode2RoundedIcon /> },
  { key: 'manual',  label: 'Manual',  icon: <LinkRoundedIcon /> },
  { key: 'crm',     label: 'CRM',     icon: <PeopleAltRoundedIcon /> },
];

// ── Sub-tabs per main tab ─────────────────────────────────────────────────────
const SUB_TABS = {
  meta:    ['inbox', 'templates', 'broadcast', 'autoReply', 'workflows', 'analytics', 'settings'],
  baileys: ['setup', 'send'],
  manual:  ['wame', 'campaigns'],
  crm:     [],
};

const SUB_TAB_LABELS = {
  inbox:     'Chats',
  templates: 'Templates',
  broadcast: 'Broadcast',
  autoReply: 'Auto Reply',
  workflows: 'Workflows',
  analytics: 'Analytics',
  settings:  'Settings',
  setup:     'QR Setup',
  send:      'Quick Send',
  wame:      'wa.me Links',
  campaigns: 'Campaigns',
};

const SEARCH_PLACEHOLDER = {
  inbox:     'Search or start new chat',
  templates: 'Search templates',
  broadcast: 'Search broadcasts',
  autoReply: 'Search auto replies',
  workflows: 'Search workflows',
  setup:     '',
  send:      '',
  wame:      'Enter recipient name or number',
  campaigns: 'Search campaigns',
  crm:       'Search contacts',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getFriendlyStatusError = (error) => {
  const statusCode = error?.response?.status;
  if (statusCode === 401 || statusCode === 403) return 'Token expired. Please sign in again.';
  if (!error?.response) return 'Network issue. Please check your internet connection.';
  if (statusCode >= 500) return 'Server error while checking WhatsApp status.';
  return parseApiError(error, 'Unable to check WhatsApp status right now.');
};

const getConnectConfigPayload = (response) => {
  const data = response?.data?.data || response?.data || {};
  return {
    configId:   data?.configId   || data?.config_id   || data?.configurationId || '',
    appId:      data?.appId      || data?.app_id      || '',
    apiVersion: data?.apiVersion || data?.api_version  || 'v20.0',
    raw: data,
  };
};

const SectionSurface = ({ children }) => (
  <Paper
    variant="outlined"
    sx={{
      height: '100%',
      minHeight: 0,
      borderRadius: { xs: 0, lg: 4 },
      overflow: 'hidden',
      borderColor: 'rgba(17, 27, 33, 0.12)',
      boxShadow: { lg: '0 24px 55px rgba(17, 27, 33, 0.14)' },
      bgcolor: '#f7f8fa',
    }}
  >
    {children}
  </Paper>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function WhatsAppCloudDashboard() {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('lg'));
  const isMobile  = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const [search,              setSearch]              = useState('');
  const [connectionState,     setConnectionState]     = useState('loading');
  const [connectionStatus,    setConnectionStatus]    = useState('Checking...');
  const [statusError,         setStatusError]         = useState('');
  const [lastCheckedAt,       setLastCheckedAt]       = useState(null);
  const [statusTick,          setStatusTick]          = useState(0);
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
  const [mobileMenuAnchorEl,  setMobileMenuAnchorEl]  = useState(null);
  const [manualDialogOpen,    setManualDialogOpen]    = useState(false);
  const [manualForm,          setManualForm]          = useState({
    accessToken: '', phoneNumberId: '', businessAccountId: '',
    wabaId: '', displayPhoneNumber: '', verifiedName: '',
  });
  const [manualFormError, setManualFormError] = useState('');

  const {
    userName, userGroup, mobileNumber,
    whatsappAccount, whatsappAccountStatus,
    isAccountLoading, isAccountConnected, accountConnectionMode,
    refreshWhatsAppAccount,
    whatsappProvider, updateWhatsappProvider,
  } = useAuth();
  const outletContext = useOutletContext() || {};

  const isAdminUser = String(userGroup || '').toLowerCase() === 'admin';

  // Admin always sees everything; a regular user who hasn't chosen yet also
  // sees everything until they do (the forced prompt below handles that).
  const visibleMainTabs = useMemo(() => MAIN_TABS.filter((tab) => {
    if (isAdminUser) return true;
    if (tab.key === 'meta') return whatsappProvider !== 'baileys';
    if (tab.key === 'baileys') return whatsappProvider !== 'meta';
    return true;
  }), [isAdminUser, whatsappProvider]);

  const needsProviderChoice = !isAdminUser && !whatsappProvider;
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const handleSaveProviderChoice = useCallback((value) => updateWhatsappProvider(value), [updateWhatsappProvider]);

  // Main tab + sub-tab state
  const [mainTab, setMainTab] = useState('meta');
  const [subTabs, setSubTabs] = useState({ meta: isAdminUser ? 'settings' : 'inbox', baileys: 'setup', manual: 'wame', crm: '' });

  // CRM → Manual campaign handoff
  const [crmRecipients, setCrmRecipients] = useState(null);
  const handleCrmSend = useCallback((contacts) => {
    setCrmRecipients(contacts);
    setMainTab('manual');
    setSubTabs(prev => ({ ...prev, manual: 'wame' }));
  }, []);

  const activeSubTab = SUB_TABS[mainTab]?.length ? (subTabs[mainTab] || SUB_TABS[mainTab][0]) : '';
  const setSubTab = (key) => setSubTabs(prev => ({ ...prev, [mainTab]: key }));

  // Search placeholder
  const searchPlaceholder = SEARCH_PLACEHOLDER[activeSubTab] || SEARCH_PLACEHOLDER[mainTab] || 'Search';

  // Active label for mobile header
  const activeLabel = mainTab === 'crm'
    ? 'CRM'
    : SUB_TAB_LABELS[activeSubTab] || MAIN_TABS.find(t => t.key === mainTab)?.label || '';

  // Admin redirect
  useEffect(() => {
    if (isAdminUser) { setMainTab('meta'); setSubTabs(prev => ({ ...prev, meta: 'settings' })); }
  }, [isAdminUser]);

  // Cloud API status polling (only relevant for Meta tab)
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active) return;
      setConnectionState(prev => (prev === 'connected' || prev === 'disconnected' ? prev : 'loading'));
      setStatusError('');
      try {
        const res = await fetchWhatsAppStatus();
        const data = res?.data;
        const ok = data?.status === 'connected' || (Array.isArray(data?.data) && data.data.some(a => a?.status === 'connected'));
        if (!active) return;
        setConnectionState(ok ? 'connected' : 'disconnected');
        setConnectionStatus(ok ? 'Connected' : 'Disconnected');
      } catch (err) {
        if (!active) return;
        setConnectionState('error'); setConnectionStatus('Unavailable');
        setStatusError(getFriendlyStatusError(err));
      } finally { if (active) setLastCheckedAt(new Date()); }
    };
    refresh();
    const id = setInterval(refresh, 12000);
    return () => { active = false; clearInterval(id); };
  }, [statusTick, isAdminUser]);

  const handleConnectFlow = useCallback(async () => {
    setIsAccountActionLoading(true);
    try {
      const cfg = getConnectConfigPayload(await fetchWhatsAppConnectConfig());
      if (!cfg.appId || !cfg.configId) {
        toast.error('Meta Embedded Signup is not configured yet. Use "Connect manually" instead.');
        return;
      }

      await loadFacebookSdk({ appId: cfg.appId, apiVersion: cfg.apiVersion });

      // Start listening before FB.login — Meta's popup can post the
      // WA_EMBEDDED_SIGNUP message before (or without ever) resolving the
      // FB.login promise below.
      const embeddedSignupDataPromise = listenForEmbeddedSignupData();

      const loginResult = await new Promise((resolve) =>
        window.FB.login(resolve, {
          config_id: cfg.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {} },
        })
      );
      const code = loginResult?.authResponse?.code;
      if (!code) throw new Error('Meta Embedded Signup did not return an authorization code.');

      const { wabaId, phoneNumberId, businessId } = await embeddedSignupDataPromise;

      await completeWhatsAppConnect({ code, wabaId, phoneNumberId, businessId });
      await refreshWhatsAppAccount();
      setStatusTick(p => p + 1);
      toast.success('WhatsApp account connected.');
    } catch (err) {
      toast.error(parseApiError(err, 'Could not complete WhatsApp connect. Try "Connect manually" instead.'));
    } finally { setIsAccountActionLoading(false); }
  }, [refreshWhatsAppAccount]);

  const handleDisconnect = useCallback(async (accountId) => {
    if (!accountId) return;
    setIsAccountActionLoading(true);
    try {
      await disconnectWhatsAppAccount(accountId);
      await refreshWhatsAppAccount();
      setStatusTick(p => p + 1);
      toast.success('WhatsApp account disconnected.');
    } catch (err) { toast.error(parseApiError(err, 'Could not disconnect account.')); }
    finally { setIsAccountActionLoading(false); }
  }, [refreshWhatsAppAccount]);

  const handleReconnect = useCallback(async () => {
    if (!whatsappAccount?.id) return;
    setIsAccountActionLoading(true);
    try {
      await revalidateWhatsAppAccount(whatsappAccount.id);
      await refreshWhatsAppAccount();
      setStatusTick(p => p + 1);
      toast.success('WhatsApp account revalidated.');
    } catch (err) { toast.error(parseApiError(err, 'Could not revalidate account.')); }
    finally { setIsAccountActionLoading(false); }
  }, [refreshWhatsAppAccount, whatsappAccount?.id]);

  const resetManualForm = useCallback(() => {
    setManualForm({ accessToken: '', phoneNumberId: '', businessAccountId: '', wabaId: '', displayPhoneNumber: '', verifiedName: '' });
    setManualFormError('');
  }, []);

  const handleManualConnect = useCallback(async () => {
    if (!manualForm.accessToken || !manualForm.phoneNumberId) { setManualFormError('Access token and Phone number ID are required.'); return; }
    if (!manualForm.businessAccountId && !manualForm.wabaId) { setManualFormError('Provide Business account ID or WABA ID.'); return; }
    setManualFormError('');
    setIsAccountActionLoading(true);
    try {
      await connectWhatsAppManual({
        accessToken: manualForm.accessToken?.trim(),
        phoneNumberId: manualForm.phoneNumberId?.trim(),
        businessAccountId: manualForm.businessAccountId?.trim() || undefined,
        wabaId: manualForm.wabaId?.trim() || undefined,
        displayPhoneNumber: manualForm.displayPhoneNumber?.trim() || undefined,
        verifiedName: manualForm.verifiedName?.trim() || undefined,
      });
      setManualDialogOpen(false);
      resetManualForm();
      await refreshWhatsAppAccount();
      setStatusTick(p => p + 1);
      toast.success('WhatsApp account connected manually.');
    } catch (err) { setManualFormError(parseApiError(err, 'Could not connect account manually.')); }
    finally { setIsAccountActionLoading(false); }
  }, [manualForm, refreshWhatsAppAccount, resetManualForm]);

  // ── Section renderer ────────────────────────────────────────────────────────
  const sectionNode = useMemo(() => {
    // Admin override — admin's own account/webhook destinations, the shared
    // Meta webhook config, and the "manage other users" panel, all in one place.
    if (isAdminUser && mainTab === 'meta' && activeSubTab === 'settings') {
      return (
        <Stack spacing={2.5}>
          <AdminAnalyticsPanel />
          <MetaWebhookConfigPanel />
          <WhatsAppAttendanceSettings
            whatsappAccount={whatsappAccount}
            isAccountConnected={isAccountConnected}
            isAccountLoading={isAccountLoading}
            onConnect={handleConnectFlow}
            onDisconnect={handleDisconnect}
            onRefreshAccount={refreshWhatsAppAccount}
            onManualConnect={() => setManualDialogOpen(true)}
            onReconnect={handleReconnect}
            whatsappAccountStatus={whatsappAccountStatus}
            accountConnectionMode={accountConnectionMode}
            accountActionLoading={isAccountActionLoading}
          />
          <AdminUserManagementPanel />
        </Stack>
      );
    }

    // Baileys (no account connection needed)
    if (mainTab === 'baileys') return <BaileysPanel />;

    // Manual (no account connection needed)
    if (mainTab === 'manual') {
      if (activeSubTab === 'campaigns') return <CampaignsPanel />;
      return <ManualInvitePanel initialRecipients={crmRecipients} onCrmRecipientsConsumed={() => setCrmRecipients(null)} />;
    }

    // CRM (no account connection needed)
    if (mainTab === 'crm') return <CRMPanel search={search} onSendContacts={handleCrmSend} />;

    // Meta — needs Cloud API connection for most sub-tabs
    if (mainTab === 'meta') {
      // Settings always accessible
      if (activeSubTab === 'settings') {
        return (
          <WhatsAppAttendanceSettings
            whatsappAccount={whatsappAccount}
            isAccountConnected={isAccountConnected}
            isAccountLoading={isAccountLoading}
            onConnect={handleConnectFlow}
            onDisconnect={handleDisconnect}
            onRefreshAccount={refreshWhatsAppAccount}
            onManualConnect={() => setManualDialogOpen(true)}
            onReconnect={handleReconnect}
            whatsappAccountStatus={whatsappAccountStatus}
            accountConnectionMode={accountConnectionMode}
            accountActionLoading={isAccountActionLoading}
          />
        );
      }
      // Analytics accessible regardless
      if (activeSubTab === 'analytics') return <AnalyticsDashboard />;

      // Other Meta tabs need account connection
      if (!isAccountConnected) {
        return (
          <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', minHeight: 260, textAlign: 'center', px: 3 }}>
            <Typography variant="h6" fontWeight={700}>Connect your WhatsApp account</Typography>
            <Typography variant="body2" color="text.secondary">
              Connect your Meta number to access Chats, Templates, Broadcast, and Auto Reply.
            </Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" justifyContent="center">
              <Button variant="contained" onClick={handleConnectFlow} disabled={isAccountActionLoading}>
                {isAccountActionLoading ? 'Connecting...' : 'Connect with Meta'}
              </Button>
              <Button variant="text" onClick={() => setManualDialogOpen(true)} disabled={isAccountActionLoading}>
                Connect manually
              </Button>
              <Button variant="outlined" onClick={() => { refreshWhatsAppAccount(); setStatusTick(p => p + 1); }} disabled={isAccountLoading}>
                Refresh status
              </Button>
            </Stack>
          </Stack>
        );
      }

      if (activeSubTab === 'inbox')     return <MessagesPanel search={search} />;
      if (activeSubTab === 'templates') return <SendMessagePanel search={search} />;
      if (activeSubTab === 'broadcast') return <BulkSender standalone search={search} />;
      if (activeSubTab === 'autoReply') return <AutoReplyManagementPanel search={search} />;
      if (activeSubTab === 'workflows') return <WorkflowManagementPanel search={search} />;
    }

    return null;
  }, [
    mainTab, activeSubTab, search,
    isAdminUser, isAccountConnected, isAccountLoading,
    isAccountActionLoading, whatsappAccount, whatsappAccountStatus,
    accountConnectionMode, handleConnectFlow, handleDisconnect,
    handleReconnect, refreshWhatsAppAccount,
    crmRecipients, handleCrmSend,
  ]);

  const connectionChipColor = connectionState === 'connected' ? 'success' : connectionState === 'loading' ? 'warning' : 'error';
  const mobileMenuOpen = Boolean(mobileMenuAnchorEl);
  const lastSyncLabel = lastCheckedAt
    ? `Last sync ${lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Last sync pending';
  const mobileUserMeta = userGroup || mobileNumber || 'No profile details';

  const subTabList = SUB_TABS[mainTab] || [];

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { lg: '72px minmax(0, 1fr)' }, bgcolor: { xs: '#e9edef', lg: '#111b21' } }}>

      {/* ── Desktop sidebar (4 main tabs as icon list) ── */}
      {isDesktop && (
        <Box sx={{ bgcolor: '#111b21', color: '#cfd4d8', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack alignItems="center" sx={{ py: 2.5, height: '100%' }}>
            <Avatar sx={{ bgcolor: '#25d366', color: '#072f25', fontWeight: 700, mb: 2 }}>WA</Avatar>
            <List dense sx={{ width: '100%', px: 1 }}>
              {visibleMainTabs.map(item => (
                <ListItemButton
                  key={item.key}
                  selected={mainTab === item.key}
                  onClick={() => setMainTab(item.key)}
                  sx={{
                    borderRadius: 2, mb: 0.5, minHeight: 48, justifyContent: 'center',
                    '&.Mui-selected': { bgcolor: '#202c33', color: '#25d366' },
                  }}
                >
                  <Tooltip title={item.label} placement="right">
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 0 }}>{item.icon}</ListItemIcon>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
            <Box sx={{ mt: 'auto' }}>
              <Tooltip title={userName || 'Profile'}>
                <Avatar sx={{ width: 36, height: 36, mb: 1 }}>{(userName || 'U').slice(0, 1).toUpperCase()}</Avatar>
              </Tooltip>
              <Tooltip title="Settings">
                <IconButton sx={{ color: '#cfd4d8' }} onClick={() => { setMainTab('meta'); setSubTab('settings'); }}>
                  <SettingsRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {!isAdminUser && (
                <Tooltip title="WhatsApp provider">
                  <IconButton sx={{ color: '#cfd4d8' }} onClick={() => setProviderDialogOpen(true)}>
                    <SwapHorizRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Logout">
                <IconButton sx={{ color: '#cfd4d8' }} onClick={outletContext.onLogout}>
                  <LogoutRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Box>
      )}

      {/* ── Main content column ── */}
      <Stack sx={{ minWidth: 0, minHeight: '100dvh', pb: { xs: 8, md: 0 } }}>

        {/* Header */}
        <Paper square elevation={0} sx={{
          px: { xs: 2, lg: 2.5 }, py: { xs: 1.5, lg: 1.25 },
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: { xs: '#075e54', lg: '#f0f2f5' },
          color: { xs: '#fff', lg: 'text.primary' },
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h6" fontWeight={700}>
                {isMobile ? activeLabel : 'WhatsApp Business Hub'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {/* Cloud API status chip (only relevant for Meta tab) */}
                {mainTab === 'meta' && (
                  <Chip
                    color={connectionChipColor}
                    size="small"
                    label={connectionState === 'loading'
                      ? <Stack direction="row" alignItems="center" spacing={0.75}><CircularProgress size={12} color="inherit" /><span>{connectionStatus}</span></Stack>
                      : connectionStatus
                    }
                  />
                )}
                <IconButton size="small" onClick={() => setStatusTick(p => p + 1)} sx={{ color: { xs: '#fff', lg: 'text.primary' } }}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
                {isMobile && (
                  <IconButton size="small" onClick={e => setMobileMenuAnchorEl(e.currentTarget)} sx={{ color: '#fff' }}>
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Stack>

            {/* Search (hide for Baileys setup/send which don't need it) */}
            {!['setup', 'send'].includes(activeSubTab) && (
              <TextField
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                size="small"
                sx={{ maxWidth: { lg: 430 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 999 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
              />
            )}
          </Stack>
        </Paper>

        {/* Sub-tab bar (only when main tab has sub-tabs) */}
        {subTabList.length > 0 && (
          <Paper square elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: { xs: '#075e54', lg: '#fff' } }}>
            <Tabs
              value={activeSubTab}
              onChange={(_, v) => setSubTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              textColor="inherit"
              TabIndicatorProps={{ style: { backgroundColor: '#25d366', height: 3 } }}
              sx={{
                minHeight: 40,
                '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.75rem', color: { xs: 'rgba(255,255,255,0.75)', lg: 'text.secondary' } },
                '& .Mui-selected': { color: { xs: '#fff !important', lg: '#25d366 !important' }, fontWeight: 700 },
              }}
            >
              {subTabList.map(key => (
                <Tab key={key} value={key} label={SUB_TAB_LABELS[key]} />
              ))}
            </Tabs>
          </Paper>
        )}

        {statusError && <ErrorState message={statusError} />}

        {/* Content */}
        <Box sx={{ flex: 1, minHeight: 0, p: { xs: 0, lg: 1.5 } }}>
          <SectionSurface>
            <Suspense fallback={<LoadingSkeleton lines={isDesktop ? 9 : 7} />}>
              {sectionNode}
            </Suspense>
          </SectionSurface>
        </Box>
      </Stack>

      {/* ── Mobile bottom nav (4 main tabs) ── */}
      {!isDesktop && (
        <Paper sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1300, borderRadius: 0 }} elevation={6}>
          <BottomNavigation
            showLabels
            value={mainTab}
            onChange={(_, v) => setMainTab(v)}
            sx={{ height: 66, '& .MuiBottomNavigationAction-root': { minWidth: 0 }, '& .MuiBottomNavigationAction-label': { fontSize: '0.68rem' } }}
          >
            {MAIN_TABS.map(item => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.label}
                icon={
                  item.key === 'meta'
                    ? <Badge color="success" variant="dot">{item.icon}</Badge>
                    : item.icon
                }
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* ── Mobile overflow menu ── */}
      <Menu
        anchorEl={mobileMenuAnchorEl}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important', alignItems: 'flex-start', py: 1 }}>
          <ListItemText
            primary={userName || 'User'}
            secondary={mobileUserMeta}
            primaryTypographyProps={{ fontWeight: 700, variant: 'body2' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <ListItemText
            primary={isAccountConnected ? 'Meta: Connected' : 'Meta: Not connected'}
            secondary={whatsappAccount?.phone_number || whatsappAccount?.display_phone_number || 'No account'}
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
          />
        </MenuItem>
        <MenuItem onClick={() => { handleConnectFlow(); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><CloudRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Connect with Meta" />
        </MenuItem>
        <MenuItem onClick={() => { setManualDialogOpen(true); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Connect manually" />
        </MenuItem>
        {!isAdminUser && (
          <MenuItem onClick={() => { setProviderDialogOpen(true); setMobileMenuAnchorEl(null); }}>
            <ListItemIcon><SwapHorizRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="WhatsApp provider" />
          </MenuItem>
        )}
        {whatsappAccount?.id && (
          <MenuItem onClick={() => { handleReconnect(); setMobileMenuAnchorEl(null); }}>
            <ListItemIcon><RefreshRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Reconnect account" />
          </MenuItem>
        )}
        {isAccountConnected && whatsappAccount?.id && (
          <MenuItem onClick={() => { handleDisconnect(whatsappAccount.id); setMobileMenuAnchorEl(null); }}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Disconnect account" />
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { setMainTab('meta'); setSubTab('settings'); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>
        <MenuItem onClick={() => { setMainTab('meta'); setSubTab('analytics'); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><QueryStatsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Analytics" />
        </MenuItem>
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <ListItemText primary={lastSyncLabel} primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMobileMenuAnchorEl(null); outletContext.onLogout?.(); }}>
          <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>

      {/* ── Manual connect dialog ── */}
      <Dialog open={manualDialogOpen} onClose={() => { setManualDialogOpen(false); resetManualForm(); }} fullWidth maxWidth="sm">
        <DialogTitle>Connect WhatsApp manually</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField required label="Access token" type="password" value={manualForm.accessToken}
              onChange={e => setManualForm(p => ({ ...p, accessToken: e.target.value }))} />
            <TextField required label="Phone number ID" value={manualForm.phoneNumberId}
              onChange={e => setManualForm(p => ({ ...p, phoneNumberId: e.target.value }))} />
            <TextField label="Business account ID" value={manualForm.businessAccountId}
              onChange={e => setManualForm(p => ({ ...p, businessAccountId: e.target.value }))} />
            <TextField label="WABA ID" value={manualForm.wabaId}
              onChange={e => setManualForm(p => ({ ...p, wabaId: e.target.value }))} />
            <TextField label="Display phone number (optional)" value={manualForm.displayPhoneNumber}
              onChange={e => setManualForm(p => ({ ...p, displayPhoneNumber: e.target.value }))} />
            <TextField label="Verified name (optional)" value={manualForm.verifiedName}
              onChange={e => setManualForm(p => ({ ...p, verifiedName: e.target.value }))} />
            {manualFormError && <Typography variant="caption" color="error">{manualFormError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setManualDialogOpen(false); resetManualForm(); }}>Cancel</Button>
          <Button onClick={handleManualConnect} variant="contained" disabled={isAccountActionLoading}>
            {isAccountActionLoading ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {needsProviderChoice && (
        <WhatsappProviderDialog open forced currentValue={whatsappProvider} onSubmit={handleSaveProviderChoice} />
      )}
      <WhatsappProviderDialog
        open={providerDialogOpen}
        currentValue={whatsappProvider}
        onClose={() => setProviderDialogOpen(false)}
        onSubmit={handleSaveProviderChoice}
      />
    </Box>
  );
}
