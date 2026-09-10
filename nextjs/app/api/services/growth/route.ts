import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { Contact, InstagramAccount, WhatsAppAccount } from '@/lib/models';
import { resolveServiceAccess } from '@/lib/services/serviceAccess';

const LEAD_CATEGORY = /interest|qualified|hot|warm|follow.?up|followup|callback|reminder|quotation|quote|proposal|estimate/i;
const CUSTOMER_CATEGORY = /convert|won|customer|sale|confirmed/i;

function before(ms: number) {
  return new Date(Date.now() - ms);
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.doc._id;

    const fifteenMinutesAgo = before(15 * 60 * 1000);
    const twoDaysAgo = before(2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = before(7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = before(30 * 24 * 60 * 60 * 1000);

    const [
      access,
      newLeads7d,
      activeOpportunities,
      overdueFollowUps,
      unansweredConversations,
      reactivationCandidates,
      whatsapp,
      instagram,
    ] = await Promise.all([
      resolveServiceAccess(authed),
      Contact.countDocuments({ userId, createdAt: { $gte: sevenDaysAgo } }),
      Contact.countDocuments({ userId, category: LEAD_CATEGORY }),
      Contact.countDocuments({
        userId,
        category: LEAD_CATEGORY,
        updatedAt: { $lte: twoDaysAgo },
      }),
      Contact.countDocuments({
        userId,
        'conversation.windowOpen': true,
        'conversation.lastCustomerMessageAt': { $lte: fifteenMinutesAgo },
      }),
      Contact.countDocuments({
        userId,
        category: CUSTOMER_CATEGORY,
        $or: [
          { lastSeen: { $lte: thirtyDaysAgo } },
          { lastSeen: null, updatedAt: { $lte: thirtyDaysAgo } },
        ],
      }),
      WhatsAppAccount.findOne({ userId, isActive: true }).select('status displayPhoneNumber verifiedName').lean(),
      InstagramAccount.findOne({ userId, isActive: true }).select('status username name').lean(),
    ]);

    const whatsappConnected = whatsapp?.status === 'active';
    const instagramConnected = instagram?.status === 'active';
    const marketingEnabled = Boolean(access?.marketing?.enabled);
    const googleBusinessEnabled = Boolean(access?.['google-business']?.enabled);

    const recommendations = [
      unansweredConversations > 0
        ? {
            id: 'reply-now',
            agent: 'support',
            priority: 'urgent',
            title: `${unansweredConversations} conversation${unansweredConversations === 1 ? '' : 's'} need attention`,
            detail: 'The customer message window is open and the latest customer message is older than 15 minutes.',
            count: unansweredConversations,
            href: '/inbox',
            actionLabel: 'Open inbox',
          }
        : null,
      overdueFollowUps > 0
        ? {
            id: 'follow-up',
            agent: 'analyst',
            priority: 'high',
            title: `${overdueFollowUps} lead${overdueFollowUps === 1 ? '' : 's'} may need follow-up`,
            detail: 'Interested, follow-up or quotation contacts have not been updated for at least 2 days.',
            count: overdueFollowUps,
            href: '/contacts',
            actionLabel: 'Review contacts',
          }
        : null,
      reactivationCandidates > 0
        ? {
            id: 'reactivate',
            agent: 'marketing',
            priority: marketingEnabled ? 'high' : 'medium',
            title: `${reactivationCandidates} past customer${reactivationCandidates === 1 ? '' : 's'} can be reactivated`,
            detail: marketingEnabled
              ? 'These converted customers have been inactive for 30+ days. Build a repeat-business campaign from the shared contact base.'
              : 'These converted customers have been inactive for 30+ days. Marketing service access is required to run a campaign.',
            count: reactivationCandidates,
            href: marketingEnabled ? '/services/marketing' : '/contacts',
            actionLabel: marketingEnabled ? 'Create campaign' : 'Review customers',
          }
        : null,
      !whatsappConnected
        ? {
            id: 'connect-whatsapp',
            agent: 'support',
            priority: 'high',
            title: 'Connect WhatsApp to activate customer support automation',
            detail: 'The shared inbox and conversation intelligence become useful after a live WhatsApp Business connection is available.',
            count: 0,
            href: '/inbox',
            actionLabel: 'Open WhatsApp',
          }
        : null,
      !instagramConnected
        ? {
            id: 'connect-instagram',
            agent: 'marketing',
            priority: 'medium',
            title: 'Connect Instagram to unify social conversations',
            detail: 'Instagram can use the same tenant, contacts and service layer instead of creating a separate customer database.',
            count: 0,
            href: '/instagram',
            actionLabel: 'Open Instagram',
          }
        : null,
      !googleBusinessEnabled
        ? {
            id: 'google-business',
            agent: 'local-growth',
            priority: 'low',
            title: 'Google Business Profile is the next local-growth channel',
            detail: 'Keep it inside the shared service architecture so posts, reviews and local leads feed the same business brain.',
            count: 0,
            href: '/services/google-business',
            actionLabel: 'View service',
          }
        : null,
    ].filter(Boolean);

    const urgentCount = recommendations.filter((item: any) => item?.priority === 'urgent').length;
    const highCount = recommendations.filter((item: any) => item?.priority === 'high').length;

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          newLeads7d,
          activeOpportunities,
          overdueFollowUps,
          unansweredConversations,
          reactivationCandidates,
          urgentCount,
          highCount,
        },
        agents: {
          support: {
            status: whatsappConnected ? 'live' : 'setup',
            metric: unansweredConversations,
            metricLabel: 'need attention',
          },
          marketing: {
            status: marketingEnabled ? 'live' : 'locked',
            metric: reactivationCandidates,
            metricLabel: 'reactivation candidates',
          },
          localGrowth: {
            status: googleBusinessEnabled ? 'live' : 'next',
            metric: 0,
            metricLabel: googleBusinessEnabled ? 'service enabled' : 'Google Business next',
          },
          analyst: {
            status: 'live',
            metric: activeOpportunities,
            metricLabel: 'active opportunities',
          },
        },
        recommendations,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load growth insights');
  }
}
