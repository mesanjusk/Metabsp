'use client';

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Button } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import { getSmbKind, getSmbService } from '@/lib/smb/workspaceRegistry';
import SmbRecordList from './SmbRecordList';

/**
 * The route shell every small-business record screen shares.
 *
 * The four services differ only in which kinds they own, and that is already in the registry — so
 * the per-service route files are three lines each and this is the only place that has to know how
 * a record screen is titled or what happens when the URL names a kind the service does not have.
 */
export default function SmbRecordsRoute({ service }) {
  const params = useParams();
  const raw = Array.isArray(params?.kind) ? params.kind[0] : params?.kind;
  const config = getSmbService(service);
  const kind = config?.kinds?.includes(raw) ? raw : null;
  const meta = getSmbKind(kind);

  if (!kind || !meta) {
    return (
      <PageBody title="Screen not found">
        <Alert severity="warning" sx={{ mb: 2 }}>
          This workspace has no “{String(raw || '')}” screen.
        </Alert>
        <Button component={NextLink} href={`/services/${service}`} variant="outlined">Back to the overview</Button>
      </PageBody>
    );
  }

  return (
    <PageBody title={meta.label} description={meta.blurb}>
      <SmbRecordList service={service} kind={kind} />
    </PageBody>
  );
}
