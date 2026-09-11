'use client';

import { Alert, Stack } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import SmallBusinessWorkspace from '@/lib/ui/app/SmallBusinessWorkspace';

export default function StoreServicePage() {
  return (
    <PageBody title="Mini Store" description="Maintain products, inventory movements and review requests using the same customer and order workspace.">
      <Stack spacing={2.5}>
        <SmallBusinessWorkspace service="store" />
        <Alert severity="info">
          The internal catalogue and stock layer is active. A public checkout/storefront can be added later without creating another product or customer database.
        </Alert>
      </Stack>
    </PageBody>
  );
}
