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
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import { SERVICES, getServiceBySlug, getServiceForPath } from './serviceRegistry';
import { SMB_KINDS, getSmbService, smbRecordHref } from '@/lib/smb/workspaceRegistry';
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
 * `/home` is the front door to a platform with eleven services, and its sidebar used to list three
 * things: All services, Inbox and Contacts. Two of those are WhatsApp screens — so the one page
 * that is supposed to show what this product does instead showed one service's features, and every
 * other service was reachable only from the switcher strip above the content.
 *
 * The services are the menu now. Inbox and Contacts stay, because they are what a small business
 * opens the app to do, but under a heading that says they are shared workspace screens rather than
 * the whole product.
 */
export const HUB_NAV_SECTIONS = [
  {
    id: 'hub',
    label: 'Workspace',
    items: [
      SERVICES_ITEM,
      { href: '/inbox', label: 'Inbox', icon: ForumRoundedIcon, requiresConnection: true },
      { href: '/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
    ],
  },
  {
    id: 'hub-services',
    label: 'Services',
    // Straight from the registry, so a service added tomorrow appears here without being
    // remembered separately — the failure mode that left the hub listing three items.
    items: SERVICES.map((service) => ({
      href: service.href,
      label: service.shortLabel || service.label,
      icon: service.icon,
    })),
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

/**
 * Extra screens a service owns beyond its record kinds — things with a page of their own that are
 * not one of the shared `SmbRecord` collections.
 */
const SERVICE_EXTRAS = {
  staff: [{ href: '/services/staff/attendance', label: 'Attendance', icon: BadgeRoundedIcon }],
  payments: [{ href: '/services/payments/documents', label: 'Documents', icon: FolderRoundedIcon }],
  video: [
    { href: '/services/video/new', label: 'New video', icon: AddCircleOutlineRoundedIcon },
    { href: '/services/video/accounts', label: 'Accounts', icon: AccountCircleRoundedIcon },
  ],
};

/**
 * Any service's menu.
 *
 * Every service used to fall back to the same three items — All services, "<name> dashboard",
 * Contacts — whatever it actually contained. A service whose screens were tabs inside its landing
 * page therefore had a sidebar that listed none of them, and the tabs were not linkable.
 *
 * This builds the menu from what the service actually has: its record kinds (from the small-
 * business registry, which is also what renders those screens) plus any extra pages it owns. A
 * service with neither still gets a correct two-item menu rather than a promise of screens that
 * are not there.
 */
function genericServiceSections(service) {
  if (!service) return HUB_NAV_SECTIONS;

  const smb = getSmbService(service.slug);
  const tools = [
    ...(smb?.kinds || []).map((kind) => ({
      href: smbRecordHref(service.slug, kind),
      label: SMB_KINDS[kind]?.label || kind,
      icon: SMB_KINDS[kind]?.icon,
    })),
    ...(SERVICE_EXTRAS[service.slug] || []),
  ].filter((item) => item.icon);

  const name = service.shortLabel || service.label;

  return [
    {
      id: `${service.slug}-workspace`,
      label: name,
      items: [
        SERVICES_ITEM,
        {
          href: service.href,
          label: 'Overview',
          shortLabel: name,
          icon: InsightsRoundedIcon,
          // Tool screens live under the service's own path, so prefix matching would leave
          // "Overview" highlighted on every one of them.
          exact: true,
        },
        ...tools,
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

  // Every other service: the overview leads, then the screens it actually has. Four is the
  // ceiling because the shell adds its own "More".
  const items = getNavSections(pathname)[0]?.items || [];
  return items
    .map((item) => item.href)
    .filter((href) => href !== '/home')
    .slice(0, 3)
    .reduce((tabs, href) => (tabs.includes(href) ? tabs : [...tabs, href]), ['/home']);
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
