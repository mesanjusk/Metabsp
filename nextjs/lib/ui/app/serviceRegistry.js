import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';

/**
 * One registry for every customer-facing service in the SMB Digital OS.
 *
 * A service has its own dashboard/navigation, but it does NOT get its own user
 * database. Every module continues to use the same authenticated User,
 * Organization/tenant and shared domain models. Provider-specific models such
 * as WhatsAppAccount and InstagramAccount only store the credentials/state
 * that belong to that integration.
 */
export const SERVICES = [
  {
    slug: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    description: 'Inbox, contacts, templates, campaigns and automation.',
    href: '/inbox',
    icon: WhatsAppIcon,
    status: 'active',
  },
  {
    slug: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    description: 'Messages, comments, private replies and publishing.',
    href: '/instagram',
    icon: InstagramIcon,
    status: 'beta',
  },
  {
    slug: 'google-business',
    label: 'Google Business Profile',
    shortLabel: 'Google Business',
    description: 'Business profile, reviews, posts and local presence.',
    href: '/services/google-business',
    icon: StorefrontRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'dialer',
    label: 'Business Dialer',
    shortLabel: 'Dialer',
    description: 'Calls, lead calling, call history and follow-up.',
    href: '/services/dialer',
    icon: PhoneInTalkRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'crm',
    label: 'Mini CRM',
    shortLabel: 'CRM',
    description: 'Leads, customers, stages, reminders and follow-up.',
    href: '/services/crm',
    icon: PeopleAltRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'store',
    label: 'Mini Store',
    shortLabel: 'Store',
    description: 'Catalog, enquiry links, orders and simple commerce.',
    href: '/services/store',
    icon: StorefrontRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'institute',
    label: 'Institute Management',
    shortLabel: 'Institute',
    description: 'Enquiries, admissions, students, fees and attendance.',
    href: '/services/institute',
    icon: SchoolRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'marketing',
    label: 'Marketing & Publisher',
    shortLabel: 'Marketing',
    description: 'Create once and publish to connected social/local channels.',
    href: '/services/marketing',
    icon: CampaignRoundedIcon,
    status: 'beta',
  },
  {
    slug: 'staff',
    label: 'Staff & Tasks',
    shortLabel: 'Staff',
    description: 'Tasks, responsibility, attendance and accountability.',
    href: '/services/staff',
    icon: TaskAltRoundedIcon,
    status: 'planned',
  },
  {
    slug: 'payments',
    label: 'Payments & Documents',
    shortLabel: 'Payments',
    description: 'Payment links, quotation, invoice and business documents.',
    href: '/services/payments',
    icon: PaymentsRoundedIcon,
    status: 'planned',
  },
];

export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map((service) => [service.slug, service]));

export function getServiceBySlug(slug) {
  return SERVICE_BY_SLUG[String(slug || '')] || null;
}

export function getServiceForPath(pathname = '') {
  const path = String(pathname || '');

  if (path === '/instagram' || path.startsWith('/instagram/')) return SERVICE_BY_SLUG.instagram;

  if (path.startsWith('/services/')) {
    const slug = path.split('/').filter(Boolean)[1] || '';
    return getServiceBySlug(slug);
  }

  const whatsappPaths = [
    '/inbox',
    '/contacts',
    '/templates',
    '/broadcasts',
    '/automations',
    '/analytics',
    '/numbers',
    '/business',
    '/developers',
  ];

  if (whatsappPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return SERVICE_BY_SLUG.whatsapp;
  }

  return null;
}
