import { NextRequest } from 'next/server';
import { DELETE as deleteAccountHandler } from '../../account/[id]/route';

// The Express app mounts deleteAccount at BOTH DELETE /accounts/:id and
// DELETE /account/:id (backend/src/routes/WhatsAppCloud.js) — this file is
// that second mount point, re-using the same handler.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return deleteAccountHandler(req, ctx);
}
