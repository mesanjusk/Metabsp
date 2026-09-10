import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DynamicFormRoundedIcon from '@mui/icons-material/DynamicFormRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';

export const INSTITUTE_FEATURE_GROUPS = [
  {
    key: 'academic',
    label: 'Academic',
    description: 'Students, courses, batches, exams and attendance.',
    features: [
      { slug: 'students', label: 'Students', description: 'Student records, contact details, registration and education.', resource: 'students', icon: PeopleAltRoundedIcon, kind: 'records' },
      { slug: 'courses', label: 'Courses', description: 'Courses, duration and course/exam fees.', resource: 'courses', icon: MenuBookRoundedIcon, kind: 'records' },
      { slug: 'course-categories', label: 'Course Categories', description: 'Group and organize course offerings.', resource: 'course-categories', icon: SchoolRoundedIcon, kind: 'records' },
      { slug: 'batches', label: 'Batches', description: 'Batch timing and student grouping.', resource: 'batches', icon: GroupsRoundedIcon, kind: 'records' },
      { slug: 'education', label: 'Education / Classes', description: 'Education levels and class setup.', resource: 'education', icon: SchoolRoundedIcon, kind: 'records' },
      { slug: 'exams', label: 'Exams', description: 'Exam events and academic assessment setup.', resource: 'exams', icon: FactCheckRoundedIcon, kind: 'records' },
      { slug: 'attendance', label: 'Attendance', description: 'Mark and review student/staff attendance.', resource: 'attendance', icon: AssignmentTurnedInRoundedIcon, kind: 'records' },
      { slug: 'attendance-report', label: 'Attendance Report', description: 'Attendance history and summary.', resource: 'attendance', icon: AssessmentRoundedIcon, kind: 'report' },
      { slug: 'batch-report', label: 'Batch Report', description: 'Batch-wise academic report.', resource: 'batches', icon: AssessmentRoundedIcon, kind: 'report' },
      { slug: 'exam-report', label: 'Exam Report', description: 'Exam list and reporting.', resource: 'exams', icon: AssessmentRoundedIcon, kind: 'report' },
    ],
  },
  {
    key: 'admissions',
    label: 'Admissions & CRM',
    description: 'Enquiries through admission and follow-up.',
    features: [
      { slug: 'leads', label: 'Leads / Enquiries', description: 'Capture and manage enquiries.', resource: 'leads', icon: PersonAddAltRoundedIcon, kind: 'records' },
      { slug: 'add-lead', label: 'Add Lead', description: 'Quick lead/enquiry entry.', resource: 'leads', icon: PersonAddAltRoundedIcon, kind: 'create' },
      { slug: 'followups', label: 'Follow-ups', description: 'Next actions, notes and lead status.', resource: 'followups', icon: TrendingUpRoundedIcon, kind: 'records' },
      { slug: 'admissions', label: 'Admissions', description: 'Create and manage student admissions.', resource: 'admissions', icon: SchoolRoundedIcon, kind: 'records' },
      { slug: 'add-admission', label: 'Add Admission', description: 'Quick student admission workflow.', resource: 'admissions', icon: SchoolRoundedIcon, kind: 'create' },
      { slug: 'admission-report', label: 'Admission Report', description: 'All admissions and status.', resource: 'admissions', icon: AssessmentRoundedIcon, kind: 'report' },
      { slug: 'lead-admission-report', label: 'Lead → Admission', description: 'Track conversion from enquiry to admission.', resource: 'leads', icon: AssessmentRoundedIcon, kind: 'report' },
      { slug: 'funnel-report', label: 'Funnel Report', description: 'Lead score/source and conversion funnel.', resource: 'leads', icon: TrendingUpRoundedIcon, kind: 'funnel' },
      { slug: 'forms', label: 'Forms', description: 'Create public admission/enquiry forms.', resource: 'forms', icon: DynamicFormRoundedIcon, kind: 'records' },
      { slug: 'form-responses', label: 'Form Responses', description: 'Review submitted public forms.', resource: 'form-responses', icon: DynamicFormRoundedIcon, kind: 'records' },
    ],
  },
  {
    key: 'finance',
    label: 'Fees & Accounts',
    description: 'Fees, collections, accounts and financial reports.',
    features: [
      { slug: 'fees', label: 'Fees', description: 'Fee plans, discounts, paid amount, balance and EMI.', resource: 'fees', icon: CurrencyRupeeRoundedIcon, kind: 'records' },
      { slug: 'receipts', label: 'Receipts', description: 'Record fee receipts.', resource: 'receipts', icon: ReceiptLongRoundedIcon, kind: 'records' },
      { slug: 'payments', label: 'Payments', description: 'Record institute payments/expenses.', resource: 'payments', icon: PaymentsRoundedIcon, kind: 'records' },
      { slug: 'payment-modes', label: 'Payment Modes', description: 'Cash, UPI, bank and other payment modes.', resource: 'payment-modes', icon: PaymentsRoundedIcon, kind: 'records' },
      { slug: 'accounts', label: 'Accounts', description: 'Ledger/account masters.', resource: 'accounts', icon: AccountBalanceRoundedIcon, kind: 'records' },
      { slug: 'account-groups', label: 'Account Groups', description: 'Group accounting ledgers.', resource: 'account-groups', icon: AccountBalanceRoundedIcon, kind: 'records' },
      { slug: 'transactions', label: 'Transactions', description: 'Income/expense and financial transactions.', resource: 'transactions', icon: ReceiptLongRoundedIcon, kind: 'records' },
      { slug: 'balance-report', label: 'Student Balance', description: 'Outstanding student fee balances.', resource: 'fees', icon: AssessmentRoundedIcon, kind: 'balance' },
      { slug: 'transaction-report', label: 'Transaction Report', description: 'Transaction history and totals.', resource: 'transactions', icon: AssessmentRoundedIcon, kind: 'report' },
      { slug: 'trial-balance', label: 'Trial Balance', description: 'Account-wise debit/credit overview.', resource: 'transactions', icon: AssessmentRoundedIcon, kind: 'trial-balance' },
      { slug: 'profit-loss', label: 'Profit & Loss', description: 'Income and expense summary.', resource: 'transactions', icon: TrendingUpRoundedIcon, kind: 'profit-loss' },
      { slug: 'upi-payment', label: 'UPI Payment', description: 'UPI payment workflow from Instify.', resource: 'payments', icon: PaymentsRoundedIcon, kind: 'payment-tool' },
    ],
  },
  {
    key: 'people-admin',
    label: 'Institute & Team',
    description: 'Institute setup, centers, owners and employees.',
    features: [
      { slug: 'institute-profile', label: 'Institute Profile', description: 'Brand and institute details.', resource: 'institutes', icon: ApartmentRoundedIcon, kind: 'records' },
      { slug: 'centers', label: 'Institutes / Centers', description: 'Manage multiple centers.', resource: 'institutes', icon: ApartmentRoundedIcon, kind: 'records' },
      { slug: 'owners', label: 'Owners', description: 'Institute owner records.', resource: 'owners', icon: PeopleAltRoundedIcon, kind: 'records' },
      { slug: 'employees', label: 'Employees / Payroll', description: 'Employee and payroll-related records.', resource: 'employees', icon: BadgeRoundedIcon, kind: 'records' },
      { slug: 'users', label: 'Users & Roles', description: 'Uses MetaBSP shared users and access roles.', href: '/admin', icon: PeopleAltRoundedIcon, kind: 'shared' },
      { slug: 'organization-categories', label: 'Institute Categories', description: 'School, college, coaching and institute types.', resource: 'organization-categories', icon: SettingsRoundedIcon, kind: 'records' },
    ],
  },
  {
    key: 'data-tools',
    label: 'Data & Tools',
    description: 'Imports, exports, forms and design utilities.',
    features: [
      { slug: 'csv-import', label: 'CSV Import', description: 'Import student/lead data from CSV.', resource: 'students', icon: UploadFileRoundedIcon, kind: 'import' },
      { slug: 'academic-bulk-import', label: 'Academic Bulk Import', description: 'Bulk academic data import.', resource: 'students', icon: UploadFileRoundedIcon, kind: 'import' },
      { slug: 'bulk-download', label: 'Bulk Download', description: 'Export institute records.', resource: 'students', icon: DownloadRoundedIcon, kind: 'export' },
      { slug: 'id-card', label: 'ID Cards', description: 'Student ID-card projects and records.', resource: 'designs', icon: BadgeRoundedIcon, kind: 'design' },
      { slug: 'id-card-print', label: 'ID Card Print', description: 'Print-ready ID-card workflow.', resource: 'designs', icon: BadgeRoundedIcon, kind: 'design' },
      { slug: 'id-card-self-edit', label: 'Student ID Self Edit', description: 'Self-edit/preview workflow reference.', resource: 'designs', icon: BadgeRoundedIcon, kind: 'design' },
      { slug: 'canvas', label: 'Canvas / Design Editor', description: 'Design and custom template workflow.', resource: 'designs', icon: DesignServicesRoundedIcon, kind: 'design' },
      { slug: 'custom-templates', label: 'Custom Templates', description: 'Reusable institute design templates.', resource: 'custom-templates', icon: DesignServicesRoundedIcon, kind: 'records' },
      { slug: 'greetings', label: 'Greetings', description: 'Greeting/template records and sharing.', resource: 'greetings', icon: CelebrationRoundedIcon, kind: 'records' },
      { slug: 'tools', label: 'Tools', description: 'Institute utility tools from Instify.', resource: 'designs', icon: SettingsRoundedIcon, kind: 'tools' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Messaging workflows use the shared MetaBSP channels.',
    features: [
      { slug: 'whatsapp', label: 'WhatsApp', description: 'Open the shared MetaBSP WhatsApp inbox instead of duplicating Baileys.', href: '/inbox', icon: WhatsAppIcon, kind: 'shared' },
      { slug: 'whatsapp-settings', label: 'WhatsApp Settings', description: 'Uses MetaBSP WhatsApp number/business configuration.', href: '/numbers', icon: WhatsAppIcon, kind: 'shared' },
    ],
  },
];

export const INSTITUTE_FEATURES = INSTITUTE_FEATURE_GROUPS.flatMap((group) =>
  group.features.map((feature) => ({ ...feature, group: group.key, groupLabel: group.label }))
);

export const INSTITUTE_FEATURE_BY_SLUG = Object.fromEntries(INSTITUTE_FEATURES.map((feature) => [feature.slug, feature]));

export function getInstituteFeature(slug) {
  return INSTITUTE_FEATURE_BY_SLUG[String(slug || '')] || null;
}
