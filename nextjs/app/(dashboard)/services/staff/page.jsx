'use client';

import NextLink from 'next/link';
import { Button } from '@mui/material';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function StaffServicePage() {
  return (
    <PageBody
      title="Staff & Tasks"
      description="How the team's work is going. Tasks, responsibilities, SOPs, vendors and attendance each have a dedicated screen."
      actions={<Button component={NextLink} href="/services/staff/my-day" variant="outlined" startIcon={<TodayRoundedIcon />}>My Day</Button>}
    >
      <SmbOverview service="staff" />
    </PageBody>
  );
}
