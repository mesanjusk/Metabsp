import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { Contact, GoogleBusinessAccount, InstagramAccount, Message, WhatsAppAccount } from '@/lib/models';
import { resolveServiceAccess, SERVICE_SLUGS } from '@/lib/services/serviceAccess';

const START_OF_TODAY = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const START_OF_WEEK = () => {
  const now = new Date();
  now.setDate(now.getDate() - 7);
  return now;
};

/**
 * The same-length window immediately before the current one, so a KPI can say which way it moved.
 *
 * A number on its own is a fact; a number next to the last one is information. "412 contacts" tells
 * a shop owner nothing they can act on — "412, up 8% on last week" tells them whether what they did
 * last week worked. Every card now carries the comparison, which means the API has to count both
 * windows rather than just the live one.
 */
const START_OF_YESTERDAY = () => {
  const now = START_OF_TODAY();
  now.setDate(now.getDate() - 1);
  return now;
};

const START_OF_PREVIOUS_WEEK = () => {
  const now = new Date();
  now.setDate(now.getDate() - 14);
  return now;
};

/**
 * Percentage change, or null when there is nothing honest to say.
 *
 * Growth from zero is not "+100%", it is undefined — and rendering a number there is the quickest
 * way to make a dashboard look made up on a brand-new account, where every previous window is zero.
 * The card shows "no comparison yet" instead, which is both true and self-explaining.
 */
function deltaPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function stageFor(category = '') {
  const value = String(category || '').trim().toLowerCase();
  if (!value) return 'new';
  if (/lost|closed lost|not interested|rejected/.test(value)) return 'lost';
  if (/convert|won|customer|sale|confirmed/.test(value)) return 'converted';
  if (/quotation|quote|proposal|estimate/.test(value)) return 'quotation';
  if (/follow.?up|followup|callback|reminder/.test(value)) return 'followUp';
  if (/interest|qualified|hot|warm/.test(value)) return 'interested';
  return 'new';
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.id;
    const today = START_OF_TODAY();
    const weekAgo = START_OF_WEEK();
    const yesterday = START_OF_YESTERDAY();
    const twoWeeksAgo = START_OF_PREVIOUS_WEEK();

    const [
      access,
      totalContacts,
      newContacts7d,
      activeChats,
      messagesToday,
      incomingToday,
      outgoingToday,
      recentContacts,
      recentMessages,
      categories,
      whatsapp,
      instagram,
      googleBusiness,
      // Previous-window counts, for the delta on each card. In the same Promise.all deliberately:
      // they are independent of everything above, so they add latency only if the database is the
      // bottleneck, not a second round trip.
      contactsBeforeThisWeek,
      newContactsPrev7d,
      messagesYesterday,
      incomingYesterday,
      outgoingYesterday,
    ] = await Promise.all([
      resolveServiceAccess(authed),
      Contact.countDocuments({ userId }),
      Contact.countDocuments({ userId, createdAt: { $gte: weekAgo } }),
      Contact.countDocuments({ userId, 'conversation.windowOpen': true }),
      Message.countDocuments({ userId, $or: [{ timestamp: { $gte: today } }, { createdAt: { $gte: today } }] }),
      Message.countDocuments({
        userId,
        $and: [
          { $or: [{ timestamp: { $gte: today } }, { createdAt: { $gte: today } }] },
          { $or: [{ direction: 'incoming' }, { fromMe: false }] },
        ],
      }),
      Message.countDocuments({
        userId,
        $and: [
          { $or: [{ timestamp: { $gte: today } }, { createdAt: { $gte: today } }] },
          { $or: [{ direction: 'outgoing' }, { fromMe: true }] },
        ],
      }),
      Contact.find({ userId }).sort({ createdAt: -1 }).limit(4).select('name phone category createdAt').lean(),
      Message.find({ userId }).sort({ timestamp: -1, createdAt: -1 }).limit(6).select('from to direction fromMe body message text timestamp createdAt').lean(),
      Contact.aggregate([
        { $match: { userId: authed.doc._id } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      WhatsAppAccount.findOne({ userId, isActive: true }).select('status displayPhoneNumber verifiedName webhookSubscribed lastSyncAt').lean(),
      InstagramAccount.findOne({ userId, isActive: true }).select('status username name webhookSubscribed lastSyncAt').lean(),
      GoogleBusinessAccount.findOne({ userId, isActive: true }).select('status locationName locationTitle lastSyncAt').lean(),

      // ── Previous window, for the deltas ───────────────────────────────────────────────────
      // Total contacts as of a week ago, so "total" can show growth rather than only a count.
      Contact.countDocuments({ userId, createdAt: { $lt: weekAgo } }),
      Contact.countDocuments({ userId, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } }),
      Message.countDocuments({
        userId,
        $or: [
          { timestamp: { $gte: yesterday, $lt: today } },
          { createdAt: { $gte: yesterday, $lt: today } },
        ],
      }),
      Message.countDocuments({
        userId,
        $and: [
          { $or: [{ timestamp: { $gte: yesterday, $lt: today } }, { createdAt: { $gte: yesterday, $lt: today } }] },
          { $or: [{ direction: 'incoming' }, { fromMe: false }] },
        ],
      }),
      Message.countDocuments({
        userId,
        $and: [
          { $or: [{ timestamp: { $gte: yesterday, $lt: today } }, { createdAt: { $gte: yesterday, $lt: today } }] },
          { $or: [{ direction: 'outgoing' }, { fromMe: true }] },
        ],
      }),
    ]);

    const funnel = { new: 0, interested: 0, followUp: 0, quotation: 0, converted: 0, lost: 0 };
    for (const row of categories) {
      const stage = stageFor(String(row?._id || '')) as keyof typeof funnel;
      funnel[stage] += Number(row?.count || 0);
    }

    const availableTools = SERVICE_SLUGS.filter((slug) => access?.[slug]?.enabled).length;

    const serviceHealth = SERVICE_SLUGS.map((slug) => {
      const enabled = Boolean(access?.[slug]?.enabled);
      if (slug === 'whatsapp') {
        return {
          service: slug,
          enabled,
          connection: whatsapp?.status === 'active' ? 'connected' : whatsapp ? whatsapp.status : 'not_connected',
          detail: whatsapp?.verifiedName || whatsapp?.displayPhoneNumber || '',
        };
      }
      if (slug === 'instagram') {
        return {
          service: slug,
          enabled,
          connection: instagram?.status === 'active' ? 'connected' : instagram ? instagram.status : 'not_connected',
          detail: instagram?.username ? `@${instagram.username}` : instagram?.name || '',
        };
      }
      if (slug === 'dialer') {
        const connected = Boolean(String(process.env.BUSINESS_CALL_MANAGER_API_URL || '').trim());
        return {
          service: slug,
          enabled: true,
          connection: connected ? 'connected' : 'available',
          detail: connected
            ? 'Business Call Manager connected'
            : 'Dial leads now; connect Business Call Manager to sync call history',
        };
      }
      if (slug === 'google-business') {
        const live = googleBusiness?.status === 'active' && Boolean(googleBusiness?.locationName);
        return {
          service: slug,
          enabled,
          // A connection with no location chosen is half-done, and saying
          // "connected" there would promise reviews and posts that cannot run.
          connection: live ? 'connected' : googleBusiness ? 'pending' : 'available',
          detail: live
            ? googleBusiness?.locationTitle || 'Google Business Profile connected'
            : googleBusiness
              ? 'Choose which Google location this workspace manages'
              : 'Sign in with Google to manage reviews, posts and local performance',
        };
      }
      return {
        service: slug,
        enabled,
        connection: enabled ? 'available' : 'locked',
        detail: access?.[slug]?.reason || '',
      };
    });

    const activity = [
      ...recentContacts.map((item: any) => ({
        id: `contact-${item._id}`,
        type: 'contact',
        title: item.name || item.phone || 'New contact',
        detail: item.category ? `Contact · ${item.category}` : 'Contact added',
        at: item.createdAt,
      })),
      ...recentMessages.map((item: any) => ({
        id: `message-${item._id}`,
        type: 'message',
        title: item.fromMe || item.direction === 'outgoing' ? 'Message sent' : 'Message received',
        detail: String(item.body || item.message || item.text || '').slice(0, 90),
        at: item.timestamp || item.createdAt,
      })),
    ]
      .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        kpis: {
          totalContacts,
          newContacts7d,
          messagesToday,
          incomingToday,
          outgoingToday,
          activeChats,
          availableTools,
          connectedChannels: Number(whatsapp?.status === 'active') + Number(instagram?.status === 'active'),
        },
        /**
         * Change against the equivalent previous window, per KPI.
         *
         * `null` where there is no honest comparison — a previous window of zero makes every
         * percentage either undefined or a meaningless "+100%", which is exactly how a dashboard
         * on a new account ends up looking invented. The card renders the absence rather than a
         * number. `activeChats`, `availableTools` and `connectedChannels` are states rather than
         * flows and have no previous-window equivalent, so they are absent on purpose.
         */
        deltas: {
          totalContacts: deltaPercent(totalContacts, contactsBeforeThisWeek),
          newContacts7d: deltaPercent(newContacts7d, newContactsPrev7d),
          messagesToday: deltaPercent(messagesToday, messagesYesterday),
          incomingToday: deltaPercent(incomingToday, incomingYesterday),
          outgoingToday: deltaPercent(outgoingToday, outgoingYesterday),
        },
        channelPerformance: {
          whatsapp: {
            connected: whatsapp?.status === 'active',
            messagesToday,
            incomingToday,
            outgoingToday,
          },
          instagram: {
            connected: instagram?.status === 'active',
            note: instagram?.status === 'active' ? 'Connected · deeper analytics will appear as events are persisted' : 'Not connected',
          },
        },
        funnel,
        activity,
        serviceHealth,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load business overview');
  }
}
