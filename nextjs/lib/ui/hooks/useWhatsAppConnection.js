'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const recheck = useCallback(() => setTick((value) => value + 1), []);

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

  const connectWithMeta = useCallback(async () => {
    setIsBusy(true);
    try {
      const config = readConnectConfig(await fetchWhatsAppConnectConfig());
      if (!config.appId || !config.configId) {
        toast.error('Embedded Signup is not configured for this deployment. Use "Connect manually" instead.');
        return false;
      }

      await loadFacebookSdk({ appId: config.appId, apiVersion: config.apiVersion });

      // Start listening before FB.login: Meta's popup can post the
      // WA_EMBEDDED_SIGNUP message before — or without ever — resolving the
      // FB.login promise below.
      const embeddedSignupData = listenForEmbeddedSignupData();

      const loginResult = await new Promise((resolve) =>
        window.FB.login(resolve, {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: config.sessionInfoVersion,
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
    connectWithMeta,
    connectManually,
    disconnect,
    revalidate,
    refreshAccount: refreshWhatsAppAccount,
    recheck,
  };
}

export default useWhatsAppConnection;
