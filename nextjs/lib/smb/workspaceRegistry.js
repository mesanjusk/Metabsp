import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import MoneyOffRoundedIcon from '@mui/icons-material/MoneyOffRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';

/**
 * The small-business workspace, as data.
 *
 * CRM, Store, Staff and Payments are one engine (`SmbRecord`) presented four ways. This file is
 * the single description of that: which record kinds each service owns, what each kind is called,
 * and which numbers its overview leads with. The sidebar, the overview and the record screens all
 * read it, so a kind cannot exist in the menu without a screen to open — or the other way round.
 *
 * The record kinds used to be tabs inside a card on each service's landing page. That put the
 * service's navigation in the middle of the screen, left no room on it for an overview, and meant
 * every kind had the same URL — nothing here was linkable, bookmarkable, or reachable from the
 * sidebar where every other kind of navigation in this product lives.
 */
export const SMB_KINDS = {
  lead: { label: 'Leads', icon: PersonAddAltRoundedIcon, blurb: 'Enquiries that have not been worked yet.' },
  followup: { label: 'Follow-ups', icon: TrendingUpRoundedIcon, blurb: 'The next action owed to a customer, and when.' },
  quotation: { label: 'Quotations', icon: RequestQuoteRoundedIcon, blurb: 'Prices you have put in front of a customer.' },
  order: { label: 'Orders / Jobs', icon: ShoppingCartRoundedIcon, blurb: 'Confirmed work, and what is still owed on it.' },
  invoice: { label: 'Invoices', icon: ReceiptLongRoundedIcon, blurb: 'Issued invoices.' },
  payment: { label: 'Payments', icon: PaymentsRoundedIcon, blurb: 'Money received against orders and invoices.' },
  expense: { label: 'Expenses', icon: MoneyOffRoundedIcon, blurb: 'What the business spent.' },
  task: { label: 'Tasks', icon: TaskAltRoundedIcon, blurb: 'Work assigned to the team, and when it is due.' },
  vendor: { label: 'Vendors', icon: HandshakeRoundedIcon, blurb: 'Suppliers and the people responsible for them.' },
  product: { label: 'Products', icon: Inventory2RoundedIcon, blurb: 'What you sell.' },
  inventory: { label: 'Inventory', icon: WarehouseRoundedIcon, blurb: 'Stock movements in and out.' },
  review_request: { label: 'Review requests', icon: RateReviewRoundedIcon, blurb: 'Customers asked to leave a review.' },
};

/**
 * `metrics` are `[label, summaryKey, format]` against `/api/smb/summary`, and `figure` is the one
 * chart the overview draws, in the same shape.
 *
 * Everything inside one `figure` must be measured the same way. `/api/smb/summary` mixes bases on
 * purpose — `salesMonthPaise` and `collectedMonthPaise` are this month, `outstandingPaise` is the
 * balance on every open order ever — and a figure that puts the last one next to the first two
 * invites exactly the arithmetic that has no meaning: Payments' first draft drew "collected this
 * month" and "outstanding" as two halves of a whole and announced a share of a total that is not a
 * total of anything. Outstanding is a KPI on its own, where it needs no denominator.
 */
export const SMB_SERVICES = {
  crm: {
    title: 'Revenue pipeline',
    description: 'Turn enquiries into follow-ups, quotations and confirmed orders without duplicating customer records.',
    kinds: ['lead', 'followup', 'quotation', 'order'],
    metrics: [['Open leads', 'leadsOpen'], ['Follow-ups due', 'followupsDue'], ['Open quotations', 'quotationsOpen'], ['Open orders', 'openOrders']],
    figure: {
      title: 'Where the work stands',
      caption: 'Open records at each stage right now.',
      rows: [['Open leads', 'leadsOpen'], ['Open quotations', 'quotationsOpen'], ['Open orders', 'openOrders']],
    },
  },
  payments: {
    title: 'Payments & documents',
    description: 'Track quotations, orders, collections, balances and expenses from the same customer history.',
    kinds: ['quotation', 'order', 'payment', 'expense'],
    metrics: [
      ['Sales this month', 'salesMonthPaise', 'money'],
      ['Collected this month', 'collectedMonthPaise', 'money'],
      ['Expenses this month', 'expensesMonthPaise', 'money'],
      // All-time, unlike its three neighbours — the label has to say so, because a reader
      // scanning a row of four assumes they share a basis.
      ['Outstanding, all orders', 'outstandingPaise', 'money'],
    ],
    figure: {
      title: 'This month',
      caption: 'Billed, received and spent since the first of the month.',
      format: 'money',
      rows: [['Sales', 'salesMonthPaise'], ['Collected', 'collectedMonthPaise'], ['Expenses', 'expensesMonthPaise']],
    },
  },
  staff: {
    title: 'Staff & operations',
    description: 'Assign tasks and keep vendor responsibilities visible. Attendance has a screen of its own.',
    kinds: ['task', 'vendor'],
    metrics: [['Tasks due', 'tasksDue'], ['Tasks overdue', 'tasksOverdue'], ['Active vendors', 'vendorsActive'], ['Open orders', 'openOrders']],
    figure: {
      title: 'Where the work stands',
      caption: 'Open records right now.',
      rows: [['Tasks due today', 'tasksDue'], ['Tasks overdue', 'tasksOverdue'], ['Active vendors', 'vendorsActive']],
    },
  },
};

export const SMB_SERVICE_SLUGS = Object.keys(SMB_SERVICES);

export function getSmbService(slug) {
  return SMB_SERVICES[String(slug || '')] || null;
}

export function getSmbKind(kind) {
  return SMB_KINDS[String(kind || '')] || null;
}

/**
 * Records live under `/records/` rather than directly under the service.
 *
 * `/services/crm/[kind]` would have been prettier and wrong: a dynamic segment there outranks
 * `services/[service]/contacts` for `/services/crm/contacts`, so the shared contacts screen would
 * resolve to a record kind called "contacts" and answer "not found". The extra segment keeps the
 * two apart.
 */
export function smbRecordHref(service, kind) {
  return `/services/${service}/records/${kind}`;
}
