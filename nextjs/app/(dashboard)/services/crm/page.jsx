'use client';

import NextLink from 'next/link';
import { Button, Stack } from '@mui/material';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function CrmServicePage() {
  return (
    <PageBody
      title="Mini CRM"
      description="How the pipeline is moving. Leads, follow-ups, quotations, orders, delivery tracking and workflow templates each have a dedicated screen."
      actions={<Stack direction="row" spacing={1}><Button component={NextLink} href="/services/crm/board" variant="outlined" startIcon={<ViewKanbanRoundedIcon />}>Order board</Button></Stack>}
    >
      <SmbOverview service="crm" />
    </PageBody>
  );
}
