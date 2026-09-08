'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';
import { loadFacebookSdk, listenForEmbeddedSignupData } from '@/lib/client/facebookSdk';
import {
  completeWhatsAppConnect,
  connectWhatsAppManual,
  disconnectWhatsAppAccount,
  fetchWhatsAppConnectConfig,
  fetchWhatsAppStatus,
  revalidateWhatsAppAccount,
} from '@/lib/client/services/whatsappCloudService';
import { useAuth } from '@/lib/ui/AuthContext';

/**
 * Onboarding and connection state for the signed-in business's WhatsApp
 * numbers, in one place.
 *
 * This logic used to live inline in the single dashboard page, which is why
 * "Connect with Meta" could only be offered from that one screen. Extracting
 * it is what lets the empty state of any section, the Numbers page and the
 * top bar all start the same Embedded Signup flow — the flow App Review
 * actually assesses — instead of routing the user back to a settings tab to
 * find the button.
 */
const readConnectConfig = (response) => {
  const data = response?.data?.data || response?.data || {};
  return {
    configId: data?.configId || data?.config_id || data?.configurationId || '',
    appId: data?.appId || data?.app_id || '',
    apiVersion: data?.apiVersion || data?.api_version || 'v23.0',
    // The Facebook JS SDK version for FB.init. Served separately from the Graph
    // API version; falls back to it, then to the baseline.
    sdkVersion: data?.sdkVersion || data?.sdk_version || data?.apiVersion || data?.api_version || 'v23.0',
    // Coexistence (the WhatsApp Business app and the Cloud API on one number).
    // The server decides whether this deployment's Meta app is subscribed to
    // the coexistence webhook fields; absent or false, the popup runs the
    // ordinary Cloud API flow exactly as before.
    coexistenceEnabled: Boolean(data?.coexistenceEnabled ?? data?.coexistence_enabled),
    featureType: data?.featureType || data?.feature_type || '',
    sessionInfoVersion: data?.sessionInfoVersion || data?.session_info_version || '3',
  };
};

const friendlyStatusError = (error) => {
  const statusCode = error?.response?.status;
  if (statusCode === 401 || statusCode === 403) return 'Your session expired. Please sign in again.';
  if (!error?.response) return 'Network issue — check your connection.';
  if (statusCode >= 500) return 'We could not reach the WhatsApp status service.';
  return parseApiError(error, 'Unable to check WhatsApp status right now.');
};

const STATUS_POLL_MS = 30000;

export function useWhatsAppConnection() {
  const {
    whatsappAccount,
    whatsappAccountStatus,
    isAccountLoading,
    isAccountConnected,
    accountConnectionMode,
    refreshWhatsAppAccount,
  } = useAuth();

  const [connectionState, setConnectionState] = useState('loading');
  const [statusError, setStatusError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [tick, setTick] = useState(0);
  // Whether THIS deployment offers the coexistence path in the popup, per the
  // server config. Drives onboarding copy only — never used to claim a
  // connected number is in coexistence mode (that comes from the account).
  const [coexistenceEnabled, setCoexistenceEnabled] = useState(false);

  // Embedded Signup config + SDK are preloaded (see preloadConnect) so that
  // FB.login can be invoked directly from the user's consent click. A popup
  // opened after an intervening network fetch or script load is treated by
  // browsers as unsolicited and blocked; preloading removes that gap.
  const connectConfigRef = useRef(null);

  const recheck = useCallback(() => setTick((value) => value + 1), []);

  // Config only — safe to fetch on mount. It is a same-origin call to our own
  // API and loads nothing from Meta, so it never contacts Facebook or logs an
  // app event for a customer who never onboards.
  const preloadConfig = useCallback(async () => {
    try {
      if (!connectConfigRef.current) {
        connectConfigRef.current = readConnectConfig(await fetchWhatsAppConnectConfig());
        setCoexistenceEnabled(Boolean(connectConfigRef.current?.coexistenceEnabled));
      }
    } catch (_error) {
      // Best-effort: connectWithMeta falls back to loading on demand.
    }
    return connectConfigRef.current;
  }, []);

  // Config + the Facebook SDK. Only ever called once the customer has
  // expressed intent to onboard (the consent dialog opens), never on a plain
  // dashboard mount — loading Meta's SDK reaches out to Facebook, so it must
  // not happen for someone who never starts the flow.
  const preloadConnect = useCallback(async () => {
    try {
      const config = await preloadConfig();
      if (config?.appId && config?.configId && typeof window !== 'undefined' && !window.FB) {
        await loadFacebookSdk({ appId: config.appId, apiVersion: config.sdkVersion });
      }
      return config;
    } catch (_error) {
      return connectConfigRef.current;
    }
  }, [preloadConfig]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (!active) return;
      setStatusError('');
      try {
        const response = await fetchWhatsAppStatus();
        const data = response?.data;
        const connected =
          data?.status === 'connected' ||
          (Array.isArray(data?.data) && data.data.some((account) => account?.status === 'connected'));
        if (!active) return;
        setConnectionState(connected ? 'connected' : 'disconnected');
      } catch (error) {
        if (!active) return;
        setConnectionState('error');
        setStatusError(friendlyStatusError(error));
      } finally {
        if (active) setLastCheckedAt(new Date());
      }
    };

    refresh();
    // Every 30s, not every 12s. The status endpoint hits Meta; polling it five
    // times a minute per open tab is load with no corresponding benefit, since
    // a connection state changes on the order of days.
    const interval = setInterval(refresh, STATUS_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tick]);

  // Warm only the config on mount (no Meta SDK). The SDK is loaded later, when
  // the customer opens the consent dialog (preloadConnect), so FB.login can
  // still open directly from the consent click without contacting Meta for a
  // customer who never starts onboarding.
  useEffect(() => {
    preloadConfig();
  }, [preloadConfig]);

  const connectWithMeta = useCallback(async () => {
    setIsBusy(true);
    try {
      // Prefer the preloaded config/SDK; only fall back to loading on demand if
      // preloading has not finished (or failed), keeping the common path free of
      // any async work between the user's click and FB.login.
      let config = connectConfigRef.current;
      if (!config) {
        config = readConnectConfig(await fetchWhatsAppConnectConfig());
        connectConfigRef.current = config;
      }
      if (!config.appId || !config.configId) {
        toast.error('Embedded Signup is not configured for this deployment. Use "Connect manually" instead.');
        return false;
      }
      if (typeof window === 'undefined' || !window.FB) {
        await loadFacebookSdk({ appId: config.appId, apiVersion: config.sdkVersion });
      }

      // Start listening before FB.login: Meta's popup can post the
      // WA_EMBEDDED_SIGNUP message before — or without ever — resolving the
      // FB.login promise below.
      const embeddedSignupData = listenForEmbeddedSignupData();

      // Embedded Signup v4: a config-driven Facebook Login for Business flow.
      // sessionInfoVersion is retained because Meta's current Builder output for
      // this configuration still reports Session Info Version = 3; featureType
      // is what selects the WhatsApp Business app (coexistence) path and is
      // passed additively whenever coexistence is enabled — the same popup still
      // runs the ordinary Cloud API path for a customer with no Business app.
      const loginResult = await new Promise((resolve) =>
        window.FB.login(resolve, {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            ...(config.sessionInfoVersion ? { sessionInfoVersion: config.sessionInfoVersion } : {}),
            ...(config.coexistenceEnabled && config.featureType ? { featureType: config.featureType } : {}),
          },
        })
      );

      const code = loginResult?.authResponse?.code;
      if (!code) throw new Error('Embedded Signup did not return an authorization code.');

      const { wabaId, phoneNumberId, businessId, coexistence } = await embeddedSignupData;
      await completeWhatsAppConnect({ code, wabaId, phoneNumberId, businessId, coexistence });
      await refreshWhatsAppAccount();
      recheck();

      toast.success(
        coexistence
          ? 'Number connected. Your existing chats are importing — this can take a few minutes.'
          : 'WhatsApp number connected.'
      );
      return true;
    } catch (error) {
      toast.error(parseApiError(error, 'Could not complete the connection. Try "Connect manually" instead.'));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [recheck, refreshWhatsAppAccount]);

  const connectManually = useCallback(
    async (form) => {
      setIsBusy(true);
      try {
        await connectWhatsAppManual({
          accessToken: form.accessToken?.trim(),
          phoneNumberId: form.phoneNumberId?.trim(),
          businessAccountId: form.businessAccountId?.trim() || undefined,
          wabaId: form.wabaId?.trim() || undefined,
          displayPhoneNumber: form.displayPhoneNumber?.trim() || undefined,
          verifiedName: form.verifiedName?.trim() || undefined,
        });
        await refreshWhatsAppAccount();
        recheck();
        toast.success('WhatsApp number connected.');
        return { ok: true };
      } catch (error) {
        return { ok: false, error: parseApiError(error, 'Could not connect the number.') };
      } finally {
        setIsBusy(false);
      }
    },
    [recheck, refreshWhatsAppAccount]
  );

  const disconnect = useCallback(
    async (accountId) => {
      if (!accountId) return;
      setIsBusy(true);
      try {
        await disconnectWhatsAppAccount(accountId);
        await refreshWhatsAppAccount();
        recheck();
        toast.success('Number disconnected.');
      } catch (error) {
        toast.error(parseApiError(error, 'Could not disconnect the number.'));
      } finally {
        setIsBusy(false);
      }
    },
    [recheck, refreshWhatsAppAccount]
  );

  const revalidate = useCallback(async () => {
    if (!whatsappAccount?.id) return;
    setIsBusy(true);
    try {
      await revalidateWhatsAppAccount(whatsappAccount.id);
      await refreshWhatsAppAccount();
      recheck();
      toast.success('Connection revalidated.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not revalidate the connection.'));
    } finally {
      setIsBusy(false);
    }
  }, [recheck, refreshWhatsAppAccount, whatsappAccount?.id]);

  return {
    whatsappAccount,
    whatsappAccountStatus,
    accountConnectionMode,
    isAccountConnected,
    isAccountLoading,
    connectionState,
    statusError,
    lastCheckedAt,
    isBusy,
    coexistenceEnabled,
    preloadConnect,
    connectWithMeta,
    connectManually,
    disconnect,
    revalidate,
    refreshAccount: refreshWhatsAppAccount,
    recheck,
  };
}

export default useWhatsAppConnection;
