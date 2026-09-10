'use client';

import { useCallback, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { useAuth } from '@/lib/ui/AuthContext';
import { useWhatsAppConnection } from '@/lib/ui/hooks/useWhatsAppConnection';
import { ROUTES } from '@/lib/constants/routes';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import ConnectGate from './ConnectGate';
import ConsentDialog from '@/lib/ui/components/ConsentDialog';
import ManualConnectDialog from './ManualConnectDialog';
import { DashboardContext } from './DashboardContext';
import {
  findNavItem,
  getActiveService,
  getActiveServiceInfo,
  getMobileNavHrefs,
  getNavigationItems,
} from './navigation';
import { EMBEDDED_SIGNUP_COMING_SOON_NOTE, EMBEDDED_SIGNUP_ENABLED } from './embeddedSignup';
import { toast } from '@/lib/ui/components/Toast';
import { layout } from '@/lib/ui/theme';

/**
 * Shared authenticated frame with service-specific navigation.
 *
 * The shell remains shared so auth, account, theme and tenant context stay
 * consistent across modules. What changes by route is the visible service
 * dashboard: navigation, top-bar connection status and mobile destinations.
 */
export default function DashboardShell({ children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('lg'));
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  const { userName, userGroup, isAdmin, logout } = useAuth();
  const connection = useWhatsAppConnection();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('');

  const registerSearch = useCallback((placeholder) => {
    setSearchPlaceholder(placeholder || '');
    if (!placeholder) setSearch('');
  }, []);

  const navItem = findNavItem(pathname);
  const activeService = getActiveService(pathname);
  const activeServiceInfo = getActiveServiceInfo(pathname);
  const navigationItems = getNavigationItems(pathname);
  const isWhatsAppDashboard = activeService === 'whatsapp';

  const handleLogout = useCallback(() => {
    logout();
    router.replace(ROUTES.LOGIN);
  }, [logout, router]);

  const handleManualConnect = useCallback(
    async (form) => connection.connectManually(form),
    [connection]
  );

  const startConnect = useCallback(() => {
    if (!EMBEDDED_SIGNUP_ENABLED) {
      toast(EMBEDDED_SIGNUP_COMING_SOON_NOTE);
      return;
    }
    connection.preloadConnect?.();
    setConsentOpen(true);
  }, [connection]);

  const handleConsentAccepted = useCallback(() => {
    setConsentOpen(false);
    connection.connectWithMeta();
  }, [connection]);

  const contextValue = useMemo(
    () => ({
      search,
      setSearch,
      registerSearch,
      connection,
      openManualConnect: () => setManualOpen(true),
      startConnect,
      activeService,
      activeServiceInfo,
    }),
    [activeService, activeServiceInfo, connection, registerSearch, search, startConnect]
  );

  // Only WhatsApp screens can be blocked by WhatsApp-number state. Other
  // services have their own connection flows and must never inherit this gate.
  const gated =
    isWhatsAppDashboard &&
    navItem?.requiresConnection &&
    !connection.isAccountConnected &&
    !connection.isAccountLoading;

  const mobileItems = getMobileNavHrefs(pathname)
    .map((href) => navigationItems.find((item) => item.href === href))
    .filter(Boolean);
  const isOnMobileItem = mobileItems.some((item) => item.href === navItem?.href);
  const mobileValue = isOnMobileItem ? navItem?.href : navItem ? 'more' : false;

  return (
    <DashboardContext.Provider value={contextValue}>
      <Box
        sx={{
          height: '100dvh',
          display: 'flex',
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        {isDesktop ? (
          <AppSidebar isAdmin={isAdmin} />
        ) : (
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: layout.sidebarWidth, border: 0 } }}
          >
            <AppSidebar isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        )}

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AppTopBar
            title={navItem?.label || activeServiceInfo?.label || 'All services'}
            searchPlaceholder={gated ? '' : searchPlaceholder}
            search={search}
            onSearchChange={setSearch}
            showConnection={isWhatsAppDashboard}
            connectionState={connection.connectionState}
            connectionDetail={
              connection.whatsappAccount?.display_phone_number ||
              connection.whatsappAccount?.phone_number ||
              connection.statusError ||
              ''
            }
            lastCheckedAt={connection.lastCheckedAt}
            userName={userName}
            userGroup={userGroup}
            onOpenNav={() => setDrawerOpen(true)}
            onLogout={handleLogout}
          />

          <Box
            component="main"
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              pb: isMobile && mobileItems.length ? 7 : 0,
            }}
          >
            {gated ? (
              <ConnectGate
                sectionLabel={navItem?.label || 'This section'}
                onConnect={startConnect}
                onConnectManually={() => setManualOpen(true)}
                isBusy={connection.isBusy}
              />
            ) : (
              children
            )}
          </Box>

          {isMobile && mobileItems.length ? (
            <BottomNavigation
              value={mobileValue}
              showLabels
              sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: (theme) => theme.zIndex.appBar,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {mobileItems.map((item) => {
                const Icon = item.icon;
                return (
                  <BottomNavigationAction
                    key={item.href}
                    component={NextLink}
                    href={item.href}
                    value={item.href}
                    label={item.label}
                    icon={<Icon fontSize="small" />}
                  />
                );
              })}
              <BottomNavigationAction
                value="more"
                label="More"
                icon={<MoreHorizRoundedIcon fontSize="small" />}
                onClick={() => setDrawerOpen(true)}
              />
            </BottomNavigation>
          ) : null}
        </Box>
      </Box>

      <ConsentDialog
        open={consentOpen}
        onAccept={handleConsentAccepted}
        onDecline={() => setConsentOpen(false)}
      />

      <ManualConnectDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManualConnect}
        isBusy={connection.isBusy}
      />
    </DashboardContext.Provider>
  );
}
