'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import apiClient from '@/lib/api/client';

const SETUP_PATH = '/setup/business-profile';

export default function BusinessProfileGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === SETUP_PATH);

  useEffect(() => {
    let active = true;
    if (pathname === SETUP_PATH) {
      setReady(true);
      return () => { active = false; };
    }

    setReady(false);
    apiClient.get('/api/business-profile')
      .then((response) => {
        if (!active) return;
        if (response?.data?.data?.businessType) setReady(true);
        else router.replace(SETUP_PATH);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    return () => { active = false; };
  }, [pathname, router]);

  if (!ready) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return children;
}
