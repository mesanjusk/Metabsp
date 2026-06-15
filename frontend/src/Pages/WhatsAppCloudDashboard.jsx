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
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
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
import { ErrorState, LoadingSkeleton } from '../Components/ui';
import { useAuth } from '../context/AuthContext';

const MessagesPanel = lazy(() => import('../Components/whatsappCloud/MessagesPanel'));
const SendMessagePanel = lazy(() => import('../Components/whatsappCloud/SendMessagePanel'));
const BulkSender = lazy(() => import('../Components/whatsappCloud/BulkSender'));
const AutoReplyManagementPanel = lazy(() => import('../Components/whatsappCloud/AutoReplyManagementPanel'));
const CRMPanel = lazy(() => import('../Components/whatsappCloud/CRMPanel'));
const AnalyticsDashboard = lazy(() => import('../Components/whatsappCloud/AnalyticsDashboard'));
const WhatsAppAttendanceSettings = lazy(() => import('../Components/whatsappCloud/WhatsAppAttendanceSettings'));
const AdminUserManagementPanel = lazy(() => import('../Components/whatsappCloud/AdminUserManagementPanel'));

const navItems = [
  { key: 'inbox', label: 'Chats', icon: <ChatRoundedIcon /> },
  { key: 'templates', label: 'Templates', icon: <DescriptionRoundedIcon /> },
  { key: 'campaigns', label: 'Broadcast', icon: <CampaignRoundedIcon /> },
  { key: 'crm', label: 'CRM', icon: <PeopleAltRoundedIcon /> },
  { key: 'autoReply', label: 'Auto Reply', icon: <AutoAwesomeRoundedIcon /> },
  { key: 'analytics', label: 'Analytics', icon: <QueryStatsRoundedIcon /> },
  { key: 'settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
];

const mobileTabs = navItems.filter((item) => !['analytics', 'settings'].includes(item.key));

const searchPlaceholderByTab = {
  inbox: 'Search or start new chat',
  templates: 'Search templates',
  campaigns: 'Search broadcasts',
  crm: 'Search contacts',
  autoReply: 'Search auto replies',
  analytics: 'Search analytics',
  settings: 'Search settings',
};

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
    configId: data?.configId || data?.config_id || data?.configurationId || '',
    appId: data?.appId || data?.app_id || '',
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

export default function WhatsAppCloudDashboard() {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('lg'));
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [connectionState, setConnectionState] = useState('loading');
  const [connectionStatus, setConnectionStatus] = useState('Checking...');
  const [statusError, setStatusError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [statusTick, setStatusTick] = useState(0);
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = useState(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    wabaId: '',
    displayPhoneNumber: '',
    verifiedName: '',
  });
  const [manualFormError, setManualFormError] = useState('');
  const {
    userName,
    userGroup,
    mobileNumber,
    whatsappAccount,
    whatsappAccountStatus,
    isAccountLoading,
    isAccountConnected,
    accountConnectionMode,
    refreshWhatsAppAccount,
  } = useAuth();
  const outletContext = useOutletContext() || {};

  const isAdminUser = String(userGroup || '').toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState(isAdminUser ? 'settings' : 'inbox');

  useEffect(() => {
    if (isAdminUser) {
      setActiveTab((prev) => (prev === 'settings' ? prev : 'settings'));
    }
  }, [isAdminUser]);

  useEffect(() => {
    let active = true;

    if (isAdminUser) {
      setConnectionState('connected');
      setConnectionStatus('Admin');
      setStatusError('');
      setLastCheckedAt(new Date());
      return () => {
        active = false;
      };
    }

    const refreshConnectionStatus = async () => {
      if (!active) return;
      setConnectionState((prev) => (prev === 'connected' || prev === 'disconnected' ? prev : 'loading'));
      setStatusError('');

      try {
        const res = await fetchWhatsAppStatus();
        const data = res?.data;
        const isConnected =
          data?.status === 'connected' ||
          (Array.isArray(data?.data) && data.data.some((acc) => acc?.status === 'connected'));

        if (!active) return;
        setConnectionState(isConnected ? 'connected' : 'disconnected');
        setConnectionStatus(isConnected ? 'Connected' : 'Disconnected');
      } catch (error) {
        if (!active) return;
        setConnectionState('error');
        setConnectionStatus('Unavailable');
        setStatusError(getFriendlyStatusError(error));
      } finally {
        if (active) setLastCheckedAt(new Date());
      }
    };

    refreshConnectionStatus();
    const interval = setInterval(refreshConnectionStatus, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [statusTick]);

  const handleConnectFlow = useCallback(async () => {
    setIsAccountActionLoading(true);
    try {
      const configResponse = await fetchWhatsAppConnectConfig();
      const config = getConnectConfigPayload(configResponse);
      let payload = {};

      if (typeof window !== 'undefined' && typeof window.FB?.login === 'function' && config?.configId) {
        const loginResponse = await new Promise((resolve) => {
          window.FB.login(resolve, {
            config_id: config.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
            },
          });
        });

        const authCode = loginResponse?.authResponse?.code;
        if (!authCode) throw new Error('Meta Embedded Signup did not return an authorization code.');
        payload = {
          code: authCode,
          flow: 'embedded_signup',
          connectConfig: config.raw,
          embeddedSignupResult: loginResponse,
        };
      } else if (typeof window !== 'undefined') {
        const signupToken = window.prompt('Paste signup token/code from Meta Embedded Signup');
        if (!signupToken) return;
        payload = {
          signupToken,
          flow: 'embedded_signup',
          connectConfig: config.raw,
        };
      }
      await completeWhatsAppConnect(payload);
      await refreshWhatsAppAccount();
      setStatusTick((prev) => prev + 1);
      toast.success('WhatsApp account connected.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not complete WhatsApp connect.'));
    } finally {
      setIsAccountActionLoading(false);
    }
  }, [refreshWhatsAppAccount]);

  const handleDisconnect = useCallback(async (accountId) => {
    if (!accountId) return;
    setIsAccountActionLoading(true);
    try {
      await disconnectWhatsAppAccount(accountId);
      await refreshWhatsAppAccount();
      setStatusTick((prev) => prev + 1);
      toast.success('WhatsApp account disconnected.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not disconnect account.'));
    } finally {
      setIsAccountActionLoading(false);
    }
  }, [refreshWhatsAppAccount]);

  const handleReconnect = useCallback(async () => {
    if (!whatsappAccount?.id) return;
    setIsAccountActionLoading(true);
    try {
      await revalidateWhatsAppAccount(whatsappAccount.id);
      await refreshWhatsAppAccount();
      setStatusTick((prev) => prev + 1);
      toast.success('WhatsApp account revalidated.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not revalidate account.'));
    } finally {
      setIsAccountActionLoading(false);
    }
  }, [refreshWhatsAppAccount, whatsappAccount?.id]);

  const resetManualForm = useCallback(() => {
    setManualForm({
      accessToken: '',
      phoneNumberId: '',
      businessAccountId: '',
      wabaId: '',
      displayPhoneNumber: '',
      verifiedName: '',
    });
    setManualFormError('');
  }, []);

  const handleManualConnect = useCallback(async () => {
    if (!manualForm.accessToken || !manualForm.phoneNumberId) {
      setManualFormError('Access token and Phone number ID are required.');
      return;
    }
    if (!manualForm.businessAccountId && !manualForm.wabaId) {
      setManualFormError('Provide at least one value: Business account ID or WABA ID.');
      return;
    }
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
      setStatusTick((prev) => prev + 1);
      toast.success('WhatsApp account connected manually.');
    } catch (error) {
      setManualFormError(parseApiError(error, 'Could not connect account manually.'));
    } finally {
      setIsAccountActionLoading(false);
    }
  }, [manualForm, refreshWhatsAppAccount, resetManualForm]);

  const sectionNode = useMemo(() => {
    if (isAdminUser && activeTab === 'settings') {
      return <AdminUserManagementPanel />;
    }

    if (!isAccountConnected && activeTab !== 'settings') {
      return (
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', minHeight: 260, textAlign: 'center', px: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Connect your WhatsApp account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This workspace is account-aware. Connect your own number to load chats, templates, and broadcasts.
          </Typography>
          <Stack direction="row" spacing={1.25}>
              <Button variant="contained" onClick={handleConnectFlow} disabled={isAccountActionLoading}>
              {isAccountActionLoading ? 'Connecting...' : 'Connect with Meta'}
              </Button>
              <Button variant="text" onClick={() => setManualDialogOpen(true)} disabled={isAccountActionLoading}>
                Connect manually
              </Button>
              <Button variant="outlined" onClick={() => { refreshWhatsAppAccount(); setStatusTick((prev) => prev + 1); }} disabled={isAccountLoading}>
                Refresh status
              </Button>
          </Stack>
        </Stack>
      );
    }

    if (activeTab === 'inbox') return <MessagesPanel search={search} />;
    if (activeTab === 'templates') return <SendMessagePanel search={search} />;
    if (activeTab === 'campaigns') return <BulkSender standalone search={search} />;
    if (activeTab === 'crm') return <CRMPanel search={search} />;
    if (activeTab === 'autoReply') return <AutoReplyManagementPanel search={search} />;
    if (activeTab === 'analytics') return <AnalyticsDashboard />;
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
  }, [
    activeTab,
    handleConnectFlow,
    handleDisconnect,
    isAccountActionLoading,
    isAccountConnected,
    isAccountLoading,
    refreshWhatsAppAccount,
    handleReconnect,
    search,
    whatsappAccountStatus,
    accountConnectionMode,
    whatsappAccount,
    isAdminUser,
    userGroup,
  ]);

  const connectionChipColor =
    connectionState === 'connected' ? 'success' : connectionState === 'loading' ? 'warning' : 'error';

  const mobileMenuOpen = Boolean(mobileMenuAnchorEl);
  const lastSyncLabel = lastCheckedAt
    ? `Last sync ${lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Last sync pending';
  const activeNavLabel = navItems.find((n) => n.key === activeTab)?.label || 'Chats';
  const mobileTabValue = mobileTabs.some((item) => item.key === activeTab) ? activeTab : false;
  const mobileUserMeta = userGroup || mobileNumber || 'No profile details';

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { lg: '72px minmax(0, 1fr)' },
        bgcolor: { xs: '#e9edef', lg: '#111b21' },
      }}
    >
      {isDesktop ? (
        <Box sx={{ bgcolor: '#111b21', color: '#cfd4d8', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack alignItems="center" sx={{ py: 2.5, height: '100%' }}>
            <Avatar sx={{ bgcolor: '#25d366', color: '#072f25', fontWeight: 700, mb: 2 }}>WA</Avatar>
            <List dense sx={{ width: '100%', px: 1 }}>
              {navItems.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={activeTab === item.key}
                  onClick={() => setActiveTab(item.key)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    minHeight: 48,
                    justifyContent: 'center',
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
              <Tooltip title="Logout">
                <IconButton sx={{ color: '#cfd4d8' }} onClick={outletContext.onLogout}>
                  <LogoutRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Box>
      ) : null}

      <Stack sx={{ minWidth: 0, minHeight: '100dvh', pb: { xs: 8, md: 0 } }}>
        <Paper
          square
          elevation={0}
          sx={{
            px: { xs: 2, lg: 2.5 },
            py: { xs: 1.5, lg: 1.25 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: { xs: '#075e54', lg: '#f0f2f5' },
            color: { xs: '#fff', lg: 'text.primary' },
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h6" fontWeight={700}>
                {isMobile ? activeNavLabel : 'WhatsApp Business Hub'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  color={connectionChipColor}
                  size="small"
                  label={
                    connectionState === 'loading' ? (
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <CircularProgress size={12} color="inherit" />
                        <span>{connectionStatus}</span>
                      </Stack>
                    ) : (
                      connectionStatus
                    )
                  }
                />
                <IconButton
                  size="small"
                  onClick={() => setStatusTick((prev) => prev + 1)}
                  sx={{ color: { xs: '#fff', lg: 'text.primary' } }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
                {isMobile ? (
                  <IconButton
                    size="small"
                    onClick={(event) => setMobileMenuAnchorEl(event.currentTarget)}
                    sx={{ color: '#fff' }}
                    aria-label="More options"
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>
            </Stack>

            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholderByTab[activeTab] || 'Search'}
              size="small"
              sx={{
                maxWidth: { lg: 430 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#fff',
                  borderRadius: 999,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </Paper>

        {statusError ? <ErrorState message={statusError} /> : null}

        <Box sx={{ flex: 1, minHeight: 0, p: { xs: 0, lg: 1.5 } }}>
          <SectionSurface>
            <Suspense fallback={<LoadingSkeleton lines={isDesktop ? 9 : 7} />}>{sectionNode}</Suspense>
          </SectionSurface>
        </Box>
      </Stack>

      {!isDesktop ? (
        <Paper sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1300, borderRadius: 0 }} elevation={6}>
          <BottomNavigation
            showLabels
            value={mobileTabValue}
            onChange={(_, value) => setActiveTab(value)}
            sx={{
              height: 66,
              '& .MuiBottomNavigationAction-root': { minWidth: 0 },
              '& .MuiBottomNavigationAction-label': { fontSize: '0.68rem' },
            }}
          >
            {mobileTabs.map((item) => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.label}
                icon={
                  item.key === 'inbox' ? (
                    <Badge color="success" variant="dot">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )
                }
              />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}

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
            primary={isAccountConnected ? 'WhatsApp connected' : 'WhatsApp not connected'}
            secondary={whatsappAccount?.phone_number || whatsappAccount?.display_phone_number || 'No account selected'}
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
          />
        </MenuItem>
        {(whatsappAccount?.verified_name || accountConnectionMode) ? (
          <MenuItem disabled sx={{ opacity: '1 !important' }}>
            <ListItemText
              primary={[whatsappAccount?.verified_name, accountConnectionMode ? `Mode: ${accountConnectionMode}` : null].filter(Boolean).join(' • ')}
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            />
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => { handleConnectFlow(); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Connect with Meta" />
        </MenuItem>
        <MenuItem onClick={() => { setManualDialogOpen(true); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Connect manually" />
        </MenuItem>
        {whatsappAccount?.id ? (
          <MenuItem onClick={() => { handleReconnect(); setMobileMenuAnchorEl(null); }}>
            <ListItemIcon><RefreshRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Reconnect account" />
          </MenuItem>
        ) : null}
        {isAccountConnected && whatsappAccount?.id ? (
          <MenuItem onClick={() => { handleDisconnect(whatsappAccount.id); setMobileMenuAnchorEl(null); }}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Disconnect account" />
          </MenuItem>
        ) : null}
        <Divider />
        <MenuItem onClick={() => { setActiveTab('settings'); setMobileMenuAnchorEl(null); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>
        <MenuItem onClick={() => { setActiveTab('analytics'); setMobileMenuAnchorEl(null); }}>
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

      <Dialog open={manualDialogOpen} onClose={() => { setManualDialogOpen(false); resetManualForm(); }} fullWidth maxWidth="sm">
        <DialogTitle>Connect manually</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              required
              label="Access token"
              type="password"
              value={manualForm.accessToken}
              onChange={(event) => setManualForm((prev) => ({ ...prev, accessToken: event.target.value }))}
            />
            <TextField
              required
              label="Phone number ID"
              value={manualForm.phoneNumberId}
              onChange={(event) => setManualForm((prev) => ({ ...prev, phoneNumberId: event.target.value }))}
            />
            <TextField
              label="Business account ID"
              value={manualForm.businessAccountId}
              onChange={(event) => setManualForm((prev) => ({ ...prev, businessAccountId: event.target.value }))}
            />
            <TextField
              label="WABA ID"
              value={manualForm.wabaId}
              onChange={(event) => setManualForm((prev) => ({ ...prev, wabaId: event.target.value }))}
            />
            <TextField
              label="Display phone number (optional)"
              value={manualForm.displayPhoneNumber}
              onChange={(event) => setManualForm((prev) => ({ ...prev, displayPhoneNumber: event.target.value }))}
            />
            <TextField
              label="Verified name (optional)"
              value={manualForm.verifiedName}
              onChange={(event) => setManualForm((prev) => ({ ...prev, verifiedName: event.target.value }))}
            />
            {manualFormError ? <Typography variant="caption" color="error">{manualFormError}</Typography> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setManualDialogOpen(false); resetManualForm(); }}>Cancel</Button>
          <Button onClick={handleManualConnect} variant="contained" disabled={isAccountActionLoading}>
            {isAccountActionLoading ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
