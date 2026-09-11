import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { Contact, InstagramAccount, Message, WhatsAppAccount } from '@/lib/models';
import { resolveServiceAccess, SERVICE_SLUGS } from '@/lib/services/serviceAccess';

const PLANNED_PROVIDER_SERVICES = new Set(['google-business', 'dialer']);

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
    ]);

    const funnel = { new: 0, interested: 0, followUp: 0, quotation: 0, converted: 0, lost: 0 };
    for (const row of categories) {
      const stage = stageFor(String(row?._id || '')) as keyof typeof funnel;
      funnel[stage] += Number(row?.count || 0);
    }

    const availableTools = SERVICE_SLUGS.filter(
      (slug) => access?.[slug]?.enabled && !PLANNED_PROVIDER_SERVICES.has(slug)
    ).length;

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
      if (PLANNED_PROVIDER_SERVICES.has(slug)) {
        return {
          service: slug,
          enabled: false,
          connection: 'planned',
          detail: 'Provider connection required before this service can be used',
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
