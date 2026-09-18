'use client';

import NextLink from 'next/link';
import { Button, Stack } from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function PaymentsServicePage() {
  return (
    <PageBody
      title="Payments & Documents"
      description="Where the money stands this month. Invoices, collections, reminders, purchases, rate cards, expenses and documents use the same customer history."
      actions={<Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}><Button component={NextLink} href="/services/payments/reports" variant="outlined" startIcon={<AssessmentRoundedIcon />}>Reports</Button><Button component={NextLink} href="/services/payments/ledger" variant="outlined" startIcon={<MenuBookRoundedIcon />}>Ledger</Button><Button component={NextLink} href="/services/payments/documents" variant="outlined" startIcon={<FolderRoundedIcon />}>Documents</Button></Stack>}
    >
      <SmbOverview service="payments" />
    </PageBody>
  );
}
