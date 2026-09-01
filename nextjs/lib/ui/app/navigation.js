import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

/**
 * The product's information architecture, in one list.
 *
 * What this replaces is the substance of the change, not the styling: the
 * dashboard was a single page with three top-level tabs — "Meta", "Manual"
 * and "CRM" — and a second row of sub-tabs under the first. That grouped
 * screens by which integration built them rather than by what a user is
 * trying to do, so "Chats" and "Contacts" lived two levels apart under
 * unrelated parents, and nothing had a URL of its own: no deep link, no back
 * button, no bookmark, and a reviewer following written test steps could not
 * be sent straight to a screen.
 *
 * Each entry is now a real route. `requiresConnection` marks the sections
 * that genuinely cannot function until a WhatsApp number is connected, so the
 * shell can show one honest explanation with a working Connect button rather
 * than each panel failing in its own way.
 */
export const NAV_SECTIONS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { href: '/inbox', label: 'Inbox', icon: ForumRoundedIcon, requiresConnection: true },
      { href: '/contacts', label: 'Contacts', icon: PeopleAltRoundedIcon },
      { href: '/templates', label: 'Templates', icon: DescriptionRoundedIcon, requiresConnection: true },
      { href: '/broadcasts', label: 'Broadcasts', icon: CampaignRoundedIcon, requiresConnection: true },
      { href: '/automations', label: 'Automations', icon: BoltRoundedIcon, requiresConnection: true },
      { href: '/analytics', label: 'Analytics', icon: InsightsRoundedIcon },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { href: '/numbers', label: 'Numbers', icon: DialpadRoundedIcon },
      { href: '/developers', label: 'Developers', icon: CodeRoundedIcon },
      { href: '/settings', label: 'Settings', icon: SettingsRoundedIcon },
      { href: '/admin', label: 'Administration', icon: AdminPanelSettingsRoundedIcon, adminOnly: true },
    ],
  },
];

// Mobile gets the four most-used destinations in a bottom bar, plus an
// explicit "More" that opens the drawer.
//
// The bar previously held five Workspace destinations and nothing else, which
// made every Platform section — Numbers among them — invisible on a phone.
// The drawer was the only route to them and nothing on screen said so, so a
// customer on their phone could not find where to connect a WhatsApp number
// at all unless they happened to try the hamburger. A bottom bar with ten
// items is a menu; a bottom bar that hides the setup screen is a dead end.
export const MOBILE_NAV_HREFS = ['/inbox', '/contacts', '/templates', '/broadcasts'];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function findNavItem(pathname) {
  return ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
