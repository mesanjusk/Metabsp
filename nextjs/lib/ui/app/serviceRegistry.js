import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';

/** One registry for every customer-facing service in the SMB Digital OS. */
export const SERVICES = [
  { slug: 'whatsapp', label: 'WhatsApp', shortLabel: 'WhatsApp', description: 'Inbox, contacts, templates, campaigns and automation.', href: '/inbox', icon: WhatsAppIcon, status: 'active', tier: 'basic' },
  { slug: 'instagram', label: 'Instagram', shortLabel: 'Instagram', description: 'Messages, comments, private replies and publishing.', href: '/instagram', icon: InstagramIcon, status: 'beta', tier: 'basic' },
  { slug: 'google-business', label: 'Google Business Profile', shortLabel: 'Google Business', description: 'Business profile, reviews, posts and local presence. Provider connection required.', href: '/services/google-business', icon: StorefrontRoundedIcon, status: 'planned', tier: 'basic' },
  { slug: 'dialer', label: 'Business Dialer', shortLabel: 'Dialer', description: 'Calls, lead calling, call history and follow-up. Telephony provider required.', href: '/services/dialer', icon: PhoneInTalkRoundedIcon, status: 'planned', tier: 'basic' },
  { slug: 'crm', label: 'Mini CRM', shortLabel: 'CRM', description: 'Shared customers, leads, follow-ups, quotations and orders.', href: '/services/crm', icon: PeopleAltRoundedIcon, status: 'beta', tier: 'basic' },
  { slug: 'store', label: 'Mini Store', shortLabel: 'Store', description: 'Products, inventory movements and review requests linked to the shared workspace.', href: '/services/store', icon: StorefrontRoundedIcon, status: 'beta', tier: 'basic' },
  { slug: 'institute', label: 'Institute Management', shortLabel: 'Institute', description: 'Admissions, academics, fees, attendance, accounts, staff, forms and institute tools.', href: '/services/institute', icon: SchoolRoundedIcon, status: 'beta', tier: 'pro' },
  { slug: 'marketing', label: 'Marketing & Publisher', shortLabel: 'Marketing', description: 'Create once and publish to connected social/local channels.', href: '/services/marketing', icon: CampaignRoundedIcon, status: 'beta', tier: 'pro' },
  { slug: 'staff', label: 'Staff & Tasks', shortLabel: 'Staff', description: 'Tasks, attendance, vendor responsibility and accountability.', href: '/services/staff', icon: TaskAltRoundedIcon, status: 'beta', tier: 'pro' },
  { slug: 'payments', label: 'Payments & Documents', shortLabel: 'Payments', description: 'Quotations, customer invoices, orders, collections, balances and expenses.', href: '/services/payments', icon: PaymentsRoundedIcon, status: 'beta', tier: 'pro' },
];

export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map((service) => [service.slug, service]));
export function getServiceBySlug(slug) { return SERVICE_BY_SLUG[String(slug || '')] || null; }
export function getServiceForPath(pathname = '') {
  const path = String(pathname || '');
  if (path === '/instagram' || path.startsWith('/instagram/')) return SERVICE_BY_SLUG.instagram;
  if (path.startsWith('/services/')) return getServiceBySlug(path.split('/').filter(Boolean)[1] || '');
  const whatsappPaths = ['/inbox','/contacts','/templates','/broadcasts','/automations','/analytics','/numbers','/business','/developers'];
  if (whatsappPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return SERVICE_BY_SLUG.whatsapp;
  return null;
}
