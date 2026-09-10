import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { getServiceBySlug, getServiceForPath } from './serviceRegistry';

const SERVICES_ITEM = { href: '/home', label: 'All services', icon: HomeRoundedIcon };

export const HUB_NAV_SECTIONS = [
  {
    id: 'hub',
    label: 'Digital workspace',
    items: [SERVICES_ITEM],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/settings', label: 'Settings', icon: SettingsRoundedIcon },
      { href: '/admin', label: 'Administration', icon: AdminPanelSettingsRoundedIcon, adminOnly: true },
    ],
  },
];

export const WHATSAPP_NAV_SECTIONS = [
  {
    id: 'whatsapp-workspace',
    label: 'WhatsApp',
    items: [
      SERVICES_ITEM,
      { href: '/inbox', label: 'Inbox', icon: ForumRoundedIcon, requiresConnection: true },
      { href: '/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
      { href: '/templates', label: 'Templates', icon: DescriptionRoundedIcon, requiresConnection: true },
      { href: '/broadcasts', label: 'Broadcasts', icon: CampaignRoundedIcon, requiresConnection: true },
      { href: '/automations', label: 'Automations', icon: BoltRoundedIcon, requiresConnection: true },
      { href: '/analytics', label: 'Analytics', icon: InsightsRoundedIcon },
    ],
  },
  {
    id: 'whatsapp-platform',
    label: 'WhatsApp setup',
    items: [
      { href: '/numbers', label: 'Numbers', icon: DialpadRoundedIcon },
      { href: '/business', label: 'Business tools', icon: StorefrontRoundedIcon, requiresConnection: true },
      { href: '/developers', label: 'Developers', icon: CodeRoundedIcon },
      { href: '/settings', label: 'Settings', icon: SettingsRoundedIcon },
    ],
  },
];

export const INSTAGRAM_NAV_SECTIONS = [
  {
    id: 'instagram-workspace',
    label: 'Instagram',
    items: [
      SERVICES_ITEM,
      { href: '/instagram', label: 'Instagram dashboard', icon: InstagramIcon },
      { href: '/services/instagram/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
    ],
  },
  {
    id: 'instagram-account',
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: SettingsRoundedIcon }],
  },
];

function genericServiceSections(service) {
  if (!service) return HUB_NAV_SECTIONS;
  return [
    {
      id: `${service.slug}-workspace`,
      label: service.shortLabel || service.label,
      items: [
        SERVICES_ITEM,
        { href: service.href, label: `${service.shortLabel || service.label} dashboard`, icon: service.icon },
        { href: `/services/${service.slug}/contacts`, label: 'Contacts', icon: PeopleAltRoundedIcon },
      ],
    },
    {
      id: `${service.slug}-account`,
      label: 'Account',
      items: [{ href: '/settings', label: 'Settings', icon: SettingsRoundedIcon }],
    },
  ];
}

/**
 * Navigation is service-aware. Each service gets its own dashboard menu, but
 * contacts and other shared business data can be mounted inside that service
 * without duplicating the underlying collection or customer records.
 */
export function getNavSections(pathname = '') {
  const service = getServiceForPath(pathname);
  if (!service) return HUB_NAV_SECTIONS;
  if (service.slug === 'whatsapp') return WHATSAPP_NAV_SECTIONS;
  if (service.slug === 'instagram') return INSTAGRAM_NAV_SECTIONS;
  return genericServiceSections(service);
}

export function getActiveService(pathname = '') {
  return getServiceForPath(pathname)?.slug || 'hub';
}

export function getActiveServiceInfo(pathname = '') {
  return getServiceForPath(pathname);
}

export function getNavigationItems(pathname = '') {
  return getNavSections(pathname).flatMap((section) => section.items);
}

export function getMobileNavHrefs(pathname = '') {
  const service = getServiceForPath(pathname);
  if (!service) return [];

  if (service.slug === 'whatsapp') {
    return ['/inbox', '/contacts', '/templates', '/broadcasts'];
  }

  return ['/home', service.href, `/services/${service.slug}/contacts`];
}

export function findNavItem(pathname = '') {
  const items = getNavigationItems(pathname);
  return items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) || null;
}

export const NAV_SECTIONS = WHATSAPP_NAV_SECTIONS;
export { getServiceBySlug };
