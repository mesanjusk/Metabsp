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
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import PriceChangeRoundedIcon from '@mui/icons-material/PriceChangeRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ApprovalRoundedIcon from '@mui/icons-material/ApprovalRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';

/** One shared record registry for the small-business operating system. */
export const SMB_KINDS = {
  lead: { label: 'Leads', icon: PersonAddAltRoundedIcon, blurb: 'Enquiries that have not been worked yet.' },
  followup: { label: 'Follow-ups', icon: TrendingUpRoundedIcon, blurb: 'The next action owed to a customer, and when.' },
  quotation: { label: 'Quotations', icon: RequestQuoteRoundedIcon, blurb: 'Prices you have put in front of a customer.' },
  order: { label: 'Orders / Jobs', icon: ShoppingCartRoundedIcon, blurb: 'Confirmed work, and what is still owed on it.' },
  invoice: { label: 'Invoices', icon: ReceiptLongRoundedIcon, blurb: 'Issued invoices, including optional GST/HSN details.' },
  payment: { label: 'Payments', icon: PaymentsRoundedIcon, blurb: 'Money received against orders and invoices.' },
  payment_reminder: { label: 'Payment reminders', icon: NotificationsActiveRoundedIcon, blurb: 'Collection follow-ups for overdue or upcoming balances.' },
  expense: { label: 'Expenses', icon: MoneyOffRoundedIcon, blurb: 'What the business spent.' },
  task: { label: 'Tasks', icon: TaskAltRoundedIcon, blurb: 'Work assigned to the team, and when it is due.' },
  responsibility: { label: 'Responsibilities', icon: AssignmentIndRoundedIcon, blurb: 'Primary and backup ownership for recurring business duties.' },
  sop_task: { label: 'SOP / recurring tasks', icon: AutorenewRoundedIcon, blurb: 'Repeatable operating procedures and their recurrence.' },
  vendor: { label: 'Vendors', icon: HandshakeRoundedIcon, blurb: 'Suppliers and the people responsible for them.' },
  purchase_order: { label: 'Purchase orders', icon: ShoppingBagRoundedIcon, blurb: 'Commitments sent to vendors, with values and due dates.' },
  rate_card: { label: 'Rate cards', icon: PriceChangeRoundedIcon, blurb: 'Reusable standard prices for products and services.' },
  product: { label: 'Products', icon: Inventory2RoundedIcon, blurb: 'What you sell, including optional HSN/SAC and GST rate.' },
  inventory: { label: 'Inventory', icon: WarehouseRoundedIcon, blurb: 'Stock movements in and out.' },
  delivery: { label: 'Delivery tracking', icon: LocalShippingRoundedIcon, blurb: 'Dispatch, delivery dates, courier references and status.' },
  review_request: { label: 'Review requests', icon: RateReviewRoundedIcon, blurb: 'Customers asked to leave a review.' },
  workflow_template: { label: 'Workflow templates', icon: AccountTreeRoundedIcon, blurb: 'Reusable process templates for common customer and operations flows.' },
  social_content: { label: 'Content library', icon: CollectionsRoundedIcon, blurb: 'Reusable post ideas, creative URLs and copy.' },
  social_approval: { label: 'Post approvals', icon: ApprovalRoundedIcon, blurb: 'Content waiting for internal or customer approval.' },
  social_schedule: { label: 'Social calendar', icon: EventRoundedIcon, blurb: 'Planned posts and publishing dates across channels.' },
};

export const SMB_SERVICES = {
  crm: {
    title: 'Revenue pipeline',
    description: 'Turn enquiries into follow-ups, quotations and confirmed orders without duplicating customer records.',
    kinds: ['lead', 'followup', 'quotation', 'order', 'delivery', 'workflow_template'],
    metrics: [['Open leads', 'leadsOpen'], ['Follow-ups due', 'followupsDue'], ['Open quotations', 'quotationsOpen'], ['Open orders', 'openOrders']],
    figure: {
      title: 'Where the work stands',
      caption: 'Open records at each stage right now.',
      rows: [['Open leads', 'leadsOpen'], ['Open quotations', 'quotationsOpen'], ['Open orders', 'openOrders'], ['Deliveries open', 'deliveriesOpen']],
    },
  },
  payments: {
    title: 'Payments & documents',
    description: 'Track quotations, orders, invoices, collections, reminders, purchases and expenses from the same customer history.',
    kinds: ['quotation', 'order', 'invoice', 'payment', 'payment_reminder', 'expense', 'purchase_order', 'rate_card'],
    metrics: [
      ['Sales this month', 'salesMonthPaise', 'money'],
      ['Collected this month', 'collectedMonthPaise', 'money'],
      ['Expenses this month', 'expensesMonthPaise', 'money'],
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
    description: 'Assign tasks, define responsibilities and SOPs, and keep vendor ownership visible. Attendance has a screen of its own.',
    kinds: ['task', 'responsibility', 'sop_task', 'vendor'],
    metrics: [['Tasks due', 'tasksDue'], ['Tasks overdue', 'tasksOverdue'], ['SOPs active', 'sopsActive'], ['Active vendors', 'vendorsActive']],
    figure: {
      title: 'Where the work stands',
      caption: 'Open work and accountability right now.',
      rows: [['Tasks due today', 'tasksDue'], ['Tasks overdue', 'tasksOverdue'], ['SOPs active', 'sopsActive'], ['Responsibilities', 'responsibilitiesActive']],
    },
  },
  marketing: {
    title: 'Marketing operations',
    description: 'Keep reusable content, approvals and planned publishing dates beside the live publisher.',
    kinds: ['social_content', 'social_approval', 'social_schedule'],
    metrics: [['Library items', 'socialContentCount'], ['Awaiting approval', 'socialApprovalsOpen'], ['Scheduled posts', 'socialScheduledOpen'], ['Pending reviews', 'pendingReviews']],
    figure: {
      title: 'Marketing workflow',
      caption: 'Content moving from library to approval to scheduled publishing.',
      rows: [['Library', 'socialContentCount'], ['Approval', 'socialApprovalsOpen'], ['Scheduled', 'socialScheduledOpen']],
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

export function smbRecordHref(service, kind) {
  return `/services/${service}/records/${kind}`;
}
