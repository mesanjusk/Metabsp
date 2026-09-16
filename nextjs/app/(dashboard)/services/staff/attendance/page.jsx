'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const AttendancePanel = dynamic(() => import('@/lib/ui/whatsappCloud/AttendancePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

/** Attendance was the bottom half of the Staff landing page; it is big enough to be its own screen. */
export default function StaffAttendancePage() {
  return (
    <PageBody
      title="Attendance"
      description="Staff attendance, WhatsApp punches and biometric devices, on the existing attendance engine."
    >
      <AttendancePanel />
    </PageBody>
  );
}
