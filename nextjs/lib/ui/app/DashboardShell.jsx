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
import ServiceAccessGate from './ServiceAccessGate';
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
 * Auth and tenant context stay shared across modules. Service entitlements are
 * checked before rendering a service dashboard, while each provider API also
 * enforces its own access server-side.
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
  const isServiceOpen = activeService !== 'hub';

  const handleLogout = useCallback(() => {
    logout();
    router.replace(ROUTES.LOGIN);
  }, [logout, router]);

  const handleCloseService = useCallback(() => {
    setDrawerOpen(false);
    router.push('/home');
  }, [router]);

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

  const whatsappGate =
    isWhatsAppDashboard &&
    navItem?.requiresConnection &&
    !connection.isAccountConnected &&
    !connection.isAccountLoading;

  const mobileItems = getMobileNavHrefs(pathname)
    .map((href) => navigationItems.find((item) => item.href === href))
    .filter(Boolean);
  const isOnMobileItem = mobileItems.some((item) => item.href === navItem?.href);
  const mobileValue = isOnMobileItem ? navItem?.href : navItem ? 'more' : false;

  /**
   * One tab, sized so five of them fit a 320px phone without the labels running together.
   *
   * MUI's default action reserves 80px minimum and lets the label size itself, so "Broadcasts" next
   * to "Templates" next to "Automations" overflowed the row and the text of adjacent tabs touched.
   * `minWidth: 0` lets flex do the dividing, and the ellipsis is what makes a long label degrade
   * into something readable rather than something that collides with its neighbour.
   */
  const tabSx = {
    minWidth: 0,
    maxWidth: 'none',
    px: 0.5,
    pt: 1,
    pb: 0.75,
    gap: 0.25,
    '& .MuiBottomNavigationAction-label': {
      fontSize: '0.6875rem',
      lineHeight: 1.3,
      fontWeight: 600,
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      // MUI shrinks the label when the tab is not selected and grows it back on selection, which
      // makes the whole row twitch as you navigate. One size, always.
      '&.Mui-selected': { fontSize: '0.6875rem' },
    },
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <Box
        sx={{
          height: '100dvh',
          display: 'flex',
          overflow: 'hidden',
          bgcolor: 'background.default',
          // The viewport is declared `viewport-fit=cover`, so the app owns the area behind a
          // notch and a status bar rather than being laid out inside it. That is what makes the
          // insets below report real numbers — and it means the top one has to be paid back
          // explicitly, or the first row of chrome renders under the status bar.
          pt: 'env(safe-area-inset-top, 0px)',
          pl: 'env(safe-area-inset-left, 0px)',
          pr: 'env(safe-area-inset-right, 0px)',
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
            searchPlaceholder={whatsappGate ? '' : searchPlaceholder}
            search={search}
            onSearchChange={setSearch}
            activeService={activeService}
            showCloseService={isServiceOpen}
            onCloseService={handleCloseService}
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
              // Clears the fixed tab bar AND the gesture inset underneath it. `pb: 7` used to be
              // exactly the bar's height, which left the last line of every page tucked behind it.
              pb: isMobile && mobileItems.length ? `calc(${layout.mobileTabBarTotal} + 8px)` : 0,
              // Momentum scrolling, and no rubber-banding the whole app when a list hits its end.
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'contain',
            }}
          >
            <ServiceAccessGate pathname={pathname}>
              {whatsappGate ? (
                <ConnectGate
                  sectionLabel={navItem?.label || 'This section'}
                  onConnect={startConnect}
                  onConnectManually={() => setManualOpen(true)}
                  isBusy={connection.isBusy}
                />
              ) : (
                children
              )}
            </ServiceAccessGate>
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
                // Height is the bar; the inset is padding *inside* it, so the bar's own background
                // runs all the way to the bottom of the screen (an installed app with a gap of page
                // colour under the tab bar looks broken) while the touch targets sit above the
                // phone's gesture pill.
                height: layout.mobileTabBarTotal,
                pb: 'env(safe-area-inset-bottom, 0px)',
                alignItems: 'stretch',
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
                    label={item.shortLabel || item.label}
                    icon={<Icon fontSize="small" />}
                    sx={tabSx}
                  />
                );
              })}
              <BottomNavigationAction
                value="more"
                label="More"
                icon={<MoreHorizRoundedIcon fontSize="small" />}
                onClick={() => setDrawerOpen(true)}
                sx={tabSx}
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
