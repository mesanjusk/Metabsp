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
import { ALL_NAV_ITEMS, MOBILE_NAV_HREFS, findNavItem } from './navigation';
import { layout } from '@/lib/ui/theme';

/**
 * The application frame every signed-in screen renders inside.
 *
 * It owns four things so no individual page has to: navigation, the top bar,
 * the connect-a-number gate, and the manual-connect dialog. Pages become what
 * they should be — the content of one section — instead of each re-deriving
 * connection state and re-implementing its own empty state.
 *
 * The layout is a fixed-height grid rather than a scrolling document: the
 * inbox needs its conversation list and thread to scroll independently while
 * the shell stays put, which a page-level scroll cannot do.
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

  // Identity, not just a setter: passing the raw setState down would make the
  // registering effect in useDashboardSearch re-run on every shell render.
  const registerSearch = useCallback((placeholder) => {
    setSearchPlaceholder(placeholder || '');
    if (!placeholder) setSearch('');
  }, []);

  const navItem = findNavItem(pathname);

  const handleLogout = useCallback(() => {
    logout();
    router.replace(ROUTES.LOGIN);
  }, [logout, router]);

  const handleManualConnect = useCallback(
    async (form) => connection.connectManually(form),
    [connection]
  );

  /**
   * Informed consent before Embedded Signup.
   *
   * ConsentDialog already existed — it lists exactly what the platform will be
   * able to do with a connected WhatsApp Business Account, and links the Terms
   * and Privacy Policy — but nothing in the application ever rendered it, so
   * customers granted access with no disclosure at all. Meta expects a Tech
   * Provider to obtain informed consent before taking access to a customer's
   * WABA, and this is where that happens: nothing calls FB.login until the
   * dialog is accepted.
   */
  const startConnect = useCallback(() => setConsentOpen(true), []);

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
      // Sections call this rather than connection.connectWithMeta directly, so
      // the consent step can never be bypassed by adding a new entry point.
      startConnect,
    }),
    [connection, registerSearch, search, startConnect]
  );

  // A section that needs a connected number, on an account that has none.
  // `isAccountLoading` matters: without it the gate flashes on every load
  // before the account request resolves, which reads as "you were disconnected".
  const gated =
    navItem?.requiresConnection && !connection.isAccountConnected && !connection.isAccountLoading;

  const mobileItems = MOBILE_NAV_HREFS.map((href) => ALL_NAV_ITEMS.find((item) => item.href === href)).filter(
    Boolean
  );
  // Anything not in the bar — Numbers, Developers, Settings, Administration,
  // Automations, Analytics — lights up "More" instead of leaving the bar with
  // nothing selected, so the current screen always has a visible home.
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
            title={navItem?.label || 'Dashboard'}
            searchPlaceholder={gated ? '' : searchPlaceholder}
            search={search}
            onSearchChange={setSearch}
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
              pb: isMobile ? 7 : 0,
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

          {isMobile ? (
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
