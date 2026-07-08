import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';
import {
  fetchBillingPlans,
  fetchCurrentSubscription,
  subscribeToPlan,
  fetchInvoices,
  downloadInvoicePdf,
} from '../../services/billingService';

const formatRupees = (paise) => `₹${((paise || 0) / 100).toFixed(2)}`;

const SUBSCRIPTION_STATUS_COLOR = {
  active: 'success',
  pending_mandate: 'warning',
  past_due: 'error',
  canceled: 'default',
};

const INVOICE_STATUS_COLOR = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  void: 'default',
};

export default function BillingPanel() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribingPlanId, setSubscribingPlanId] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [plansRes, subscriptionRes, invoicesRes] = await Promise.all([
        fetchBillingPlans(),
        fetchCurrentSubscription(),
        fetchInvoices(),
      ]);
      setPlans(plansRes?.data?.data || []);
      setSubscription(subscriptionRes?.data?.data || null);
      setInvoices(invoicesRes?.data?.data || []);
    } catch (err) {
      setError(parseApiError(err, 'Could not load billing information.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async (planId) => {
    setSubscribingPlanId(planId);
    try {
      const res = await subscribeToPlan(planId);
      const authorizationLink = res?.data?.data?.authorizationLink;
      if (authorizationLink) {
        window.open(authorizationLink, '_blank', 'noopener,noreferrer');
        toast.success('Complete the UPI Autopay authorization in the new tab to activate your plan.');
      } else {
        toast.success('Subscription created.');
      }
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not start the subscription.'));
    } finally {
      setSubscribingPlanId('');
    }
  };

  const handleDownload = async (invoice) => {
    try {
      await downloadInvoicePdf(invoice.id || invoice._id, invoice.invoiceNumber);
    } catch (err) {
      toast.error(parseApiError(err, 'Could not download the invoice.'));
    }
  };

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Loading billing information...</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Billing</Typography>

      {error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {subscription ? (
        <Alert
          severity={subscription.status === 'active' ? 'success' : 'info'}
          sx={{ mb: 2 }}
        >
          Current plan: <strong>{subscription.planId?.name || 'Unknown plan'}</strong>{' '}
          <Chip size="small" label={subscription.status} color={SUBSCRIPTION_STATUS_COLOR[subscription.status] || 'default'} sx={{ ml: 1 }} />
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>No active subscription yet — choose a plan below.</Alert>
      )}

      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Available plans</Typography>
      <List dense disablePadding sx={{ mb: 2 }}>
        {plans.map((plan) => (
          <ListItem
            key={plan.id || plan._id}
            divider
            secondaryAction={
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleSubscribe(plan.id || plan._id)}
                disabled={Boolean(subscribingPlanId) || subscription?.status === 'active'}
              >
                {subscribingPlanId === (plan.id || plan._id) ? 'Starting…' : 'Subscribe via UPI'}
              </Button>
            }
          >
            <ListItemText
              primary={`${plan.name} — ${formatRupees(plan.priceInPaise)}/${plan.billingInterval === 'yearly' ? 'yr' : 'mo'}`}
              secondary={`Includes ${plan.includedMessages || 0} messages, then ${formatRupees(plan.overagePricePerMessageInPaise)} per extra message`}
            />
          </ListItem>
        ))}
        {plans.length === 0 ? <Typography variant="body2" color="text.secondary">No plans available yet.</Typography> : null}
      </List>

      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Invoices</Typography>
      <List dense disablePadding>
        {invoices.map((invoice) => (
          <ListItem
            key={invoice.id || invoice._id}
            divider
            secondaryAction={
              <Button size="small" variant="text" onClick={() => handleDownload(invoice)}>
                Download PDF
              </Button>
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>{invoice.invoiceNumber}</Typography>
                  <Chip size="small" label={invoice.status} color={INVOICE_STATUS_COLOR[invoice.status] || 'default'} variant="outlined" />
                </Stack>
              }
              secondary={`${formatRupees(invoice.totalAmountInPaise)} · ${new Date(invoice.periodStart).toLocaleDateString()} – ${new Date(invoice.periodEnd).toLocaleDateString()}`}
            />
          </ListItem>
        ))}
        {invoices.length === 0 ? <Typography variant="body2" color="text.secondary">No invoices yet.</Typography> : null}
      </List>
    </Box>
  );
}
