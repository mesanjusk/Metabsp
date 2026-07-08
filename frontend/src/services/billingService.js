import apiClient from '../apiClient';

export const fetchBillingPlans = () => apiClient.get('/api/billing/plans');
export const fetchCurrentSubscription = () => apiClient.get('/api/billing/subscription');
export const subscribeToPlan = (planId) => apiClient.post('/api/billing/subscribe', { planId });
export const fetchInvoices = () => apiClient.get('/api/billing/invoices');

// A plain <a href> can't carry the Authorization header the invoice PDF
// route requires, so fetch it as a blob and trigger the download manually.
export async function downloadInvoicePdf(invoiceId, invoiceNumber) {
  const response = await apiClient.get(`/api/billing/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${invoiceNumber || invoiceId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
