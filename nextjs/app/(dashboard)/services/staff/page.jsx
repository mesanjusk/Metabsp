'use client';

import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function StaffServicePage() {
  return (
    <PageBody
      title="Staff & Tasks"
      description="How the team's work is going. Tasks, vendors and attendance each have a screen in the menu on the left."
    >
      <SmbOverview service="staff" />
    </PageBody>
  );
}
