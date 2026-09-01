import { NextResponse } from 'next/server';
import { withApiKeyAccount, externalApiError, normalizeExternalPhone } from '@/lib/http/externalApi';
import Message from '@/lib/models/Message';

/**
 * GET /api/v1/messages — read the conversation, from another system.
 *
 * The platform already pushes every inbound message to registered webhook
 * destinations, which is the right shape when the other system can accept an
 * HTTP request. Plenty cannot: a desktop tool, a script behind NAT, a
 * short-lived job, or anything whose operator would rather poll than run a
 * public endpoint. Without this, "receive messages from another platform"
 * simply had no answer for them.
 *
 * Cursor is `since`, an ISO timestamp — not a page number, because a
 * conversation grows while you page through it and offsets skip rows. Poll
 * with the `nextSince` from the previous response and you cannot miss one.
 *
 * Query parameters:
 *   since      ISO timestamp; only messages created strictly after it
 *   direction  incoming | outgoing (default: both)
 *   phone      restrict to one contact
 *   limit      1-200 (default 50)
 */
const MAX_LIMIT = 200;

export const GET = withApiKeyAccount(
  'messages',
  async ({ req, principal, accountContext }) => {
    try {
      const { searchParams } = new URL(req.url);

      const rawLimit = Number(searchParams.get('limit'));
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : 50;

      const filter: Record<string, unknown> = {
        // Scoped to the key owner's own number. A phone number in the query
        // narrows the result; it can never widen it to another tenant's data.
        userId: principal.userId,
      };
      if (accountContext?.account?._id) filter.whatsappAccountId = accountContext.account._id;

      const since = searchParams.get('since');
      if (since) {
        const sinceDate = new Date(since);
        if (Number.isNaN(sinceDate.getTime())) {
          return NextResponse.json(
            { success: false, operation: 'messages', message: 'since must be an ISO 8601 timestamp' },
            { status: 400 }
          );
        }
        filter.createdAt = { $gt: sinceDate };
      }

      const direction = String(searchParams.get('direction') || '').toLowerCase();
      if (direction === 'incoming' || direction === 'outgoing') filter.direction = direction;

      const phone = normalizeExternalPhone(searchParams.get('phone'));
      if (phone) filter.$or = [{ from: phone }, { to: phone }];

      // Ascending, so a caller appending to their own store stays in order and
      // the last row is the natural next cursor.
      const rows: any[] = await Message.find(filter).sort({ createdAt: 1 }).limit(limit).lean();

      const data = rows.map((row) => ({
        id: String(row._id),
        messageId: row.messageId || '',
        direction: row.direction || (row.fromMe ? 'outgoing' : 'incoming'),
        from: row.from || '',
        to: row.to || '',
        type: row.type || 'text',
        text: row.text || row.body || row.message || '',
        mediaUrl: row.mediaUrl || '',
        mimeType: row.mimeType || '',
        status: row.status || '',
        timestamp: row.timestamp || row.createdAt,
        createdAt: row.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data,
        // Echoed back so a caller can poll in a loop without tracking state
        // itself. Null when the page was empty — keep the cursor you had.
        nextSince: rows.length ? new Date(rows[rows.length - 1].createdAt).toISOString() : null,
        hasMore: rows.length === limit,
      });
    } catch (error) {
      return externalApiError(error, 'messages');
    }
  },
  // Polling is cheap and read-only; a tighter budget than sending would just
  // push integrators into longer, lossier intervals.
  { rateLimit: { windowMs: 60 * 1000, maxRequests: 120 } }
);
