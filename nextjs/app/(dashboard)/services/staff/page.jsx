'use client';

import dynamic from 'next/dynamic';
import { Stack, Typography } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';
import SmallBusinessWorkspace from '@/lib/ui/app/SmallBusinessWorkspace';

const AttendancePanel = dynamic(() => import('@/lib/ui/whatsappCloud/AttendancePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function StaffServicePage() {
  return (
    <PageBody title="Staff & Tasks" description="Tasks and vendors share the business workspace; attendance uses the existing WhatsApp + biometric attendance engine.">
      <Stack spacing={3}>
        <SmallBusinessWorkspace service="staff" />
        <Stack spacing={1}>
          <Typography variant="h6" fontWeight={800}>Attendance</Typography>
          <Typography variant="body2" color="text.secondary">Manage staff attendance, WhatsApp punches and biometric devices from the same staff area.</Typography>
          <AttendancePanel />
        </Stack>
      </Stack>
    </PageBody>
  );
}
