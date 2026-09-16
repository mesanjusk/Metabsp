import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { getServiceBySlug, getServiceForPath } from './serviceRegistry';
import { INSTITUTE_FEATURE_GROUPS, instituteFeatureHref } from '@/lib/institute/featureRegistry';

/**
 * `shortLabel` is what the mobile tab bar uses.
 *
 * A tab is about 64px wide on a 320px phone. "All services" and "Instagram dashboard" are correct
 * in a sidebar and unreadable in a tab, so the items that need a shorter name carry one, and
 * everything else falls back to its full label.
 */
const SERVICES_ITEM = { href: '/home', label: 'All services', shortLabel: 'Home', icon: HomeRoundedIcon };

/**
 * The hub's own menu.
 *
 * Contacts and Inbox are listed here, not only inside WhatsApp: they are the two things a small
 * business opens the app to do, and reaching them used to mean opening a service first. They are
 * also what gives the hub a mobile tab bar — `getMobileNavHrefs` returns a row per *service*, and
 * on the hub it returned nothing at all, so /home was the one screen in the product with no
 * bottom navigation on a phone. An app whose home screen has no tab bar reads as a website.
 */
export const HUB_NAV_SECTIONS = [
  {
    id: 'hub',
    label: 'Digital workspace',
    items: [
      SERVICES_ITEM,
      { href: '/inbox', label: 'Inbox', icon: ForumRoundedIcon, requiresConnection: true },
      { href: '/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
    ],
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
      { href: '/whatsapp', label: 'WhatsApp dashboard', shortLabel: 'WhatsApp', icon: WhatsAppIcon },
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
      { href: '/instagram', label: 'Instagram dashboard', shortLabel: 'Instagram', icon: InstagramIcon },
      { href: '/services/instagram/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
    ],
  },
  {
    id: 'instagram-account',
    label: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: SettingsRoundedIcon }],
  },
];

/**
 * Institute Management's menu.
 *
 * The service has sixty-odd tools. They used to live on the service's landing page as a wall of
 * cards, which made the main screen a menu and left nothing on it that answered "how is the
 * institute doing" — and put the tools somewhere you had to navigate *back* to in order to reach
 * the next one. They belong in the sidebar, where every other service keeps its navigation, so the
 * main screen is free to be the analytics overview.
 *
 * The groups come straight from the feature registry: one place decides what tools exist, so the
 * sidebar cannot drift from the routes that actually render. `collapsible` is what keeps sixty
 * items usable — a group opens when the current page is inside it, and stays shut otherwise.
 */
export const INSTITUTE_NAV_SECTIONS = [
  {
    id: 'institute-workspace',
    label: 'Institute',
    items: [
      SERVICES_ITEM,
      {
        href: '/services/institute',
        label: 'Overview',
        shortLabel: 'Overview',
        icon: InsightsRoundedIcon,
        // Every institute tool sits under this path, so prefix matching would leave "Overview"
        // highlighted on all sixty of them.
        exact: true,
      },
      { href: '/services/institute/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
    ],
  },
  ...INSTITUTE_FEATURE_GROUPS.map((group) => ({
    id: `institute-${group.key}`,
    label: group.label,
    collapsible: true,
    items: group.features.map((feature) => ({
      href: instituteFeatureHref(feature),
      label: feature.label,
      icon: feature.icon,
      // A shared tool leaves the service — the sidebar says so rather than letting the click
      // look like a dead end when the menu changes underneath it.
      shared: feature.kind === 'shared',
    })),
  })),
  {
    id: 'institute-account',
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
        {
          href: service.href,
          label: `${service.shortLabel || service.label} dashboard`,
          shortLabel: service.shortLabel || service.label,
          icon: service.icon,
        },
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
  if (service.slug === 'institute') return INSTITUTE_NAV_SECTIONS;
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

/**
 * The tab bar, per context. At most four, because the shell adds a fifth ("More").
 *
 * Five tabs is the limit a 320px phone can show with readable labels, and the shell's own "More"
 * always occupies one of them — so anything longer than four here starts truncating names rather
 * than adding destinations.
 */
export function getMobileNavHrefs(pathname = '') {
  const service = getServiceForPath(pathname);

  // The hub had no tab bar at all, which made /home the one screen that did not look like an app.
  if (!service) return ['/home', '/inbox', '/contacts', '/settings'];

  if (service.slug === 'whatsapp') {
    // The dashboard leads, as it does for every other service, but the inbox
    // keeps a tab of its own — it is what most people open the app to do.
    return ['/whatsapp', '/inbox', '/contacts', '/broadcasts'];
  }

  if (service.slug === 'institute') {
    // The overview leads; students and fees are the two tools an institute opens daily, and on a
    // phone they are worth a tab rather than a trip through the drawer.
    return ['/home', '/services/institute', '/services/institute/students', '/services/institute/fees'];
  }

  return ['/home', service.href, `/services/${service.slug}/contacts`];
}

/** Does this item own the current page? `exact` items match only themselves. */
export function matchesNavItem(pathname = '', item) {
  if (!item?.href) return false;
  if (pathname === item.href) return true;
  return !item.exact && pathname.startsWith(`${item.href}/`);
}

/**
 * The item the current page belongs to — the most specific one, not the first one listed.
 *
 * A menu that nests (an overview at `/services/institute`, a tool at `/services/institute/fees`)
 * has two items matching the tool's path by prefix. Taking the first match put the overview's name
 * in the title bar on every institute screen; the longest matching href is the one that is
 * actually rendering the page.
 */
export function findNavItem(pathname = '') {
  const items = getNavigationItems(pathname);
  return items
    .filter((item) => matchesNavItem(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0] || null;
}

export const NAV_SECTIONS = WHATSAPP_NAV_SECTIONS;
export { getServiceBySlug };
